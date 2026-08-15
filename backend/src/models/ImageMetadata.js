import mongoose from "mongoose";

const imageMetadataSchema = new mongoose.Schema(
  {
    activityRecord: { type: mongoose.Schema.Types.ObjectId, ref: "ActivityRecord", required: true },
    fileUrl: { type: String, required: true },
    uploadTimestamp: { type: Date, default: Date.now },
    exifTimestamp: { type: Date, default: null },
    gpsLat: { type: Number, default: null },
    gpsLong: { type: Number, default: null },
    checksum: { type: String, required: true, index: true },
    fileSize: { type: Number },
    fileType: { type: String },
    locationVerified: { type: Boolean, default: false },
    isDuplicate: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("ImageMetadata", imageMetadataSchema);
