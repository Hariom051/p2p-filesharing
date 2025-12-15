import mongoose, { Schema, SchemaTypes } from "mongoose";

const file = new Schema(
  {
    name: { type: SchemaTypes.String },
    type: { type: SchemaTypes.String },
    size: { type: SchemaTypes.String }, // in bytes
  },
  { _id: false }
);

const filesSchema = new Schema(
  {
    socketId: { type: SchemaTypes.String },
    roomId: { type: SchemaTypes.String },
    files: [file],
    isDeleted: { type: SchemaTypes.Boolean, default: false },
  },
  { timestamps: true }
);

export const filesModel = mongoose.model("Files", filesSchema);
