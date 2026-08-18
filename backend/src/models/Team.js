import mongoose from "mongoose";

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // A team works a single district — every activity it submits inherits this rather
    // than the field worker picking one per visit.
    district: { type: mongoose.Schema.Types.ObjectId, ref: "District", required: true },
    memberIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Member" }],
      validate: {
        validator: (v) => v.length === 2,
        message: "A team can have at most 2 social mobilizers",
      },
    },
  },
  { timestamps: true }
);

export default mongoose.model("Team", teamSchema);
