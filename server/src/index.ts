import "dotenv/config";
import { createServer } from "http";
import express from "express";
import { Server } from "socket.io";
import { app } from "./config";
import connectDb from "./db";
import { filesModel } from "./db/models/filesModel";
import RoomCodeGenerator from "./shared/utils/generateRoomId";

const expressapp = express();
const server = createServer(expressapp);
const io = new Server(server, {
  cors: { origin: app.allowedOrigins, methods: ["GET", "POST"] },
});

const PORT = process.env["PORT"] || 1234;

expressapp.get("/", (req, res) => {
  return res.json({ message: "Welcome to xerrasend" });
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Sender creates a room
  socket.on("create-room", async (data) => {
    try {
      const roomId = RoomCodeGenerator.generate();
      socket.join(roomId);

      // Save files metadata to database
      await filesModel.create({
        socketId: socket.id,
        roomId: roomId,
        files: data.files,
      });

      console.log(`Room created: ${roomId} by ${socket.id}`);
      socket.emit("room-created", { roomId });
    } catch (error) {
      console.error("Error creating room:", error);
      socket.emit("error", { message: "Failed to create room" });
    }
  });

  // Receiver joins a room
  socket.on("join-room", async (data) => {
    try {
      const { roomId } = data;
      const file = await filesModel.findOne({ roomId });

      if (!file) {
        socket.emit("error", { message: "Room not found" });
        return;
      }

      socket.join(roomId);

      console.log(`Receiver ${socket.id} joined room ${roomId}`);

      // Send files metadata to receiver
      socket.emit("files-metadata", { files: file.files });

      // Notify sender that receiver has joined
      socket.to(roomId).emit("receiver-joined");
    } catch (error) {
      console.error("Error joining room:", error);
      socket.emit("error", { message: "Failed to join room" });
    }
  });

  // Forward WebRTC signaling messages
  socket.on("offer", ({ room, sdp }) => {
    console.log(`Forwarding offer in room ${room}`);
    socket.to(room).emit("offer", { sdp, from: socket.id });
  });

  socket.on("answer", ({ room, sdp }) => {
    console.log(`Forwarding answer in room ${room}`);
    socket.to(room).emit("answer", { sdp, from: socket.id });
  });

  socket.on("candidate", ({ room, candidate }) => {
    socket.to(room).emit("candidate", { candidate, from: socket.id });
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

server.listen(PORT, async () => {
  console.log(`Signaling server running on http://localhost:${PORT}`);
  await connectDb();
});
