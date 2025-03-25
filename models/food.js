const mongoose = require("mongoose")

const FoodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    quantity: { type: Number, required: true },
    isAvailable: { type: Boolean, default: true },
    images: [
      {
        url: { type: String, required: true },
        public_id: { type: String, required: true },
      },
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Food", FoodSchema);
