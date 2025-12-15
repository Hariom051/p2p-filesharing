import mongoose from "mongoose";
import { app } from "../config";

const connectDb = async () => {
  try {
    await mongoose.connect(`${app.dbUrl}`);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

mongoose.connection.on("disconnected", () => {
  setTimeout(() => {
    mongoose.connect(`${app.dbUrl}`).catch((err) => {});
  }, 5000);
});

mongoose.connection.on("connected", () => {
  console.log("Db Connected");
});

export default connectDb;
