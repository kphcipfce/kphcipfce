import mongoose from "mongoose";

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
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
