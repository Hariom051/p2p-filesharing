import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { Download, Check } from "lucide-react";
import streamSaver from "streamsaver";
import { app } from "../config";
import { getFileIcon } from "../shared/components/getFileExtensionIcon";

interface FileMeta {
  name: string;
  size: number;
  type?: string;
}

type FileWriterMap = Record<number, WritableStreamDefaultWriter<Uint8Array>>;
type ProgressMap = Record<number, number>; // 0–100

export default function Receive() {
  const { roomId } = useParams<{ roomId: string }>();

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  const [files, setFiles] = useState<FileMeta[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const fileRef = useRef<FileMeta[]>(null);

  const [progress, setProgress] = useState<ProgressMap>({});
  const bytesReceivedRef = useRef<Record<number, number>>({});

  const fileWriters = useRef<FileWriterMap>({});

  const requestDownload = async (fileIndex: number) => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") {
      alert("Connection not ready");
      return;
    }

    const file = fileRef.current?.[fileIndex];
    if (!file) return;

    setProgress((prev) => ({ ...prev, [fileIndex]: 0 }));

    const fileStream = streamSaver.createWriteStream(file.name, {
      size: file.size,
    });

    const writer = fileStream.getWriter();
    fileWriters.current[fileIndex] = writer;

    // Track how many bytes we've written for this file
    bytesReceivedRef.current[fileIndex] = 0;

    dataChannelRef.current?.send(
      JSON.stringify({ type: "request-download", fileIndex })
    );
  };

  const handleData = (ev: MessageEvent<string | ArrayBuffer>) => {
    for (const [fileIndexStr, writer] of Object.entries(fileWriters.current)) {
      const fileIndex = Number(fileIndexStr);

      try {
        if (typeof ev.data === "string") {
          const msg = JSON.parse(ev.data);

          if (msg.type === "file-end" && msg.fileIndex === fileIndex) {
            writer.close();
            delete fileWriters.current[fileIndex];

            // Ensure final progress is 100%
            setProgress((prev) => ({ ...prev, [fileIndex]: 100 }));

            if (fileRef.current && fileRef.current.length !== fileIndex + 1) {
              requestDownload(fileIndex + 1);
            }
          }
          return;
        }

        // Binary chunk
        const chunk = new Uint8Array(ev.data);
        const prevBytes = bytesReceivedRef.current[fileIndex] || 0;
        const newBytes = prevBytes + chunk.byteLength;
        bytesReceivedRef.current[fileIndex] = newBytes;

        const file = fileRef.current?.[fileIndex];
        if (file && file.size > 0) {
          const percent = Math.min(
            100,
            Math.round((newBytes / file.size) * 100)
          );
          setProgress((prev) => ({ ...prev, [fileIndex]: percent }));
        }

        writer.write(chunk);
      } catch (e) {
        console.error("Write error:", e);
      }
    }
  };

  /* ------------------ WebRTC ------------------ */
  const createPeerConnection = (): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: app.iceServers,
    });

    pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
      if (e.candidate && socketRef.current) {
        socketRef.current.emit("candidate", {
          room: roomId,
          candidate: e.candidate,
        });
      }
    };

    pc.ondatachannel = (e: RTCDataChannelEvent) => {
      const channel = e.channel;
      channel.binaryType = "arraybuffer";
      channel.onmessage = handleData;
      dataChannelRef.current = channel;
    };

    pcRef.current = pc;
    return pc;
  };

  /* ------------------ Socket ------------------ */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const isTransferring = Object.keys(fileWriters.current).length > 0;
      if (!isTransferring) return;
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const socket = io(app.websocketUrl, {
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-room", { roomId });
    });

    socket.on("files-metadata", ({ files }: { files: FileMeta[] }) => {
      setFiles(files);
      fileRef.current = files;
    });

    socket.on("offer", async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
      const pc = createPeerConnection();
      await pc.setRemoteDescription(sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { room: roomId, sdp: pc.localDescription });
    });

    socket.on(
      "candidate",
      async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        try {
          await pcRef.current?.addIceCandidate(candidate);
        } catch (e) {
          console.warn("ICE candidate error:", e);
        }
      }
    );

    return () => {
      socket.disconnect();
      pcRef.current?.close();
    };
  }, [roomId]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  };

  // Check if all files are downloaded
  const allFilesDownloaded =
    files.length > 0 && files.every((_, index) => progress[index] === 100);

  // Check if any download is in progress
  const isDownloading = Object.values(progress).some(
    (p) => p !== undefined && p < 100
  );

  /* ------------------ UI ------------------ */
  return (
    <div className="py-20 px-4 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">
        Download {files && files.length > 0 && files.length} Files
      </h2>

      {!connected && <p className="text-orange-600">Connecting...</p>}

      <div className="space-y-3 mb-6">
        {files.map((file, index) => {
          const fileProgress = progress[index];
          const isComplete = fileProgress === 100;

          return (
            <div
              key={index}
              className="flex items-center justify-between bg-gray-50 p-4 rounded-lg"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  {isComplete ? (
                    <Check className="w-5 h-5 text-emerald-600" />
                  ) : (
                    getFileIcon(file.name)
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-800 truncate">
                    {file.name}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                    {fileProgress !== undefined && (
                      <>
                        <span className="text-gray-400">•</span>
                        <p className="text-sm text-emerald-600">
                          {fileProgress}%
                        </p>
                      </>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {fileProgress !== undefined && !isComplete && (
                    <div className="mt-2 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                        style={{ width: `${fileProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center">
        <button
          onClick={() => requestDownload(0)}
          disabled={!connected || allFilesDownloaded || isDownloading}
          className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer transition-all"
        >
          <Download size={20} />
          {allFilesDownloaded
            ? "Download complete"
            : isDownloading
            ? "Downloading..."
            : "Download"}
        </button>
      </div>
    </div>
  );
}
