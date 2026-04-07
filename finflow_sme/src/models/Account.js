import mongoose from "mongoose";

const AccountSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  type: { 
    type: String, 
    enum: ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'], 
    required: true 
  },
  balance: { type: Number, default: 0 },
  description: { type: String, trim: true }
}, { timestamps: true });

export default mongoose.models.Account || mongoose.model("Account", AccountSchema);
