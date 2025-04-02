const mongoose = require('mongoose')
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const nodemailer = require('nodemailer')
const Food = require("../models/food");
const User = require('../models/user')
const Order = require('../models/order');
const food = require('../models/food');



// function to send Email after placing an order
const sendEmail = async (to, subject, message) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  const mailOptions = {
    from: `"Mac Boy" <${process.env.EMAIL_USERNAME}>`,
    to,
    subject,
    html: message,
  };

  await transporter.sendMail(mailOptions);
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer Storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "hotelsystem",
    allowed_formats: ["jpg", "jpeg", "png"],
  },
});

// Multer Upload Middleware
const upload = multer({ storage });

//   GET ROUTES

// get all foods
module.exports.allFoodsGet = async (req, res) => {
  try {
    console.log("foods route hit!")
    const foods = await Food.find({ quantity: { $gt: 0 } })
    console.log(foods)
    res.status(200).json(foods)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

//get a single food

module.exports.foodGet = async (req, res) => {
  try {
    const id = req.params.id
    if (!id) {
      return res.status(400).json({ error: "please include the food id!" })
    }
    const food = await Food.findById(id)
    if (!food) {
      return res.status(404).json({ error: "the food was not found!" })
    }
    res.status(200).json(food)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// search foods route
module.exports.searchFoodsGet = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const foods = await Food.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { category: { $regex: query, $options: "i" } }
      ]
    });

    res.status(200).json(foods);
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}


//get all orders

module.exports.allOrdersGet = async (req, res) => {
  try {
    const allOrders = await Order.find().populate({ path: 'user', select: 'username' })
    res.status(200).json(allOrders)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}



// POST ROUTES

// Route to Add foods
module.exports.addFoodsPost = [
  (req, res, next) => {
    upload.array("images", 10)(req, res, (err) => {
      if (err) {
        console.error("Multer Error:", err.message);
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const { name, description, price, quantity, category } = req.body;


      if (!name || !description || !price || !req.files || req.files.length === 0 || !quantity || !category) {
        return res.status(400).json({ error: "All fields are required, including images." });
      }

      // Map uploaded files to get their Cloudinary URLs and public IDs
      const uploadedFiles = req.files.map((file) => ({
        url: file.path,
        public_id: file.filename,
      }));

      // Save the food to the database
      const newFood = new Food({
        name,
        description,
        price,
        category,
        quantity,
        images: uploadedFiles,
      });

      await newFood.save();

      // Emit "foodUpdated" event for all clients
      req.io.emit("foodUpdated", { action: "add", food: newFood })

      res.status(201).json({ message: "Food added successfully!", Food: newFood });
    } catch (err) {
      console.error("Error adding food:", err);
      res.status(500).json({ error: err.message });
    }
  },
];


// checkout route

module.exports.checkOutPost = async (req, res) => {
  const { userId, items, email, paymentMethod, phone } = req.body;
  const session = await mongoose.startSession(); // Start a transaction session
  session.startTransaction(); // Begin transaction

  try {

    if (!userId || !items || !email || !paymentMethod || !phone) {
      return res.status(400).json({ error: "Please include all details!" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }


    let totalAmount = 0;
    let orderItems = [];
    let unavailableItems = [];

    for (let item of items) {
      const food = await Food.findById(item.id).session(session);

      if (!food) {
        unavailableItems.push({ name: item.name || "Unknown Item", id: item.id, reason: "This food was not found!" });
        continue;
      }

      if (!food.isAvailable) {
        unavailableItems.push({ name: food.name, id: food._id, reason: "This item is not available right now!" });
        continue
      }
      if (food.quantity < item.quantity) {
        unavailableItems.push({ name: food.name, id: food._id, reason: `Only ${food.quantity} Plates remaining!` });
      }


      if (food.price !== item.price) {
        unavailableItems.push({ name: food.name, id: food._id, reason: `New price for ${food.name} is Ksh ${food.price}!` });
      }
    }

    // If there are unavailable items, stop the checkout process and notify the user
    if (unavailableItems.length > 0) {
      await session.abortTransaction(); // Rollback any changes
      session.endSession();
      return res.status(400).json({ error: "Some items are unavailable or have changed!", unavailableItems });
    }

    // Proceed to process order only if all items are available
    for (let item of items) {
      const food = await Food.findById(item.id).session(session);
      totalAmount += food.price * item.quantity;

      orderItems.push({
        food: food._id,
        name: food.name,
        quantity: item.quantity,
        price: food.price
      });

      // Reduce stock
      food.quantity -= item.quantity;

      await food.save({ session });
    }

    // Create new order
    const order = new Order({
      user: user._id,
      items: orderItems,
      totalAmount,
      paymentMethod,
      email,
      paymentStatus: "Pending",
      orderStatus: "Pending"
    });

    await order.save({ session });

    user.orderHistory.push(order._id);
    await user.save({ session });

    // Commit transaction (finalize changes)
    await session.commitTransaction();
    session.endSession();

    let orderDetails = '';
    orderItems.forEach(item => {
      orderDetails += `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${item.name}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">Ksh ${item.price * item.quantity}</td>
    </tr>
  `;
    })

    // Email to user
    const userMessage = `
        <h2>Order Confirmation</h2>
        <p>Thank you for placing your order, ${user.username}!</p>
        <h3 style="color: #333;">Order Details</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
    <thead>
      <tr>
        <th style="padding: 10px; background-color: #f2f2f2; border: 1px solid #ddd;">Item</th>
        <th style="padding: 10px; background-color: #f2f2f2; border: 1px solid #ddd; text-align: center;">Quantity</th>
        <th style="padding: 10px; background-color: #f2f2f2; border: 1px solid #ddd; text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${orderDetails}
    </tbody>
  </table>
        <p>Your order ID: ${order._id}</p>
        <p>Total: Ksh ${order.totalAmount}</p>
        <p>Date: ${new Date(order.createdAt).toLocaleString()}</p>
        <p>Payment method: ${order.paymentMethod}</p>
        <p>We will deliver the food to you.</p>
      `;
    await sendEmail(user.email, "Order Confirmation", userMessage);

    // Email to admin
    const adminMessage = `
        <h2>New Order Received</h2>
        <p>User: ${user.username} (${email})</p>
        <p>Phone Number: ${phone}</p>
        <p>Order ID: ${order._id}</p>
        <h3 style="color: #333;">Order Details</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
    <thead>
      <tr>
        <th style="padding: 10px; background-color: #f2f2f2; border: 1px solid #ddd;">Item</th>
        <th style="padding: 10px; background-color: #f2f2f2; border: 1px solid #ddd; text-align: center;">Quantity</th>
        <th style="padding: 10px; background-color: #f2f2f2; border: 1px solid #ddd; text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${orderDetails}
    </tbody>
  </table>
        <p>Total: Ksh ${order.totalAmount}</p>
        <p>Payment method: ${order.paymentMethod}</p>
        <p>Date: ${new Date(order.createdAt).toLocaleString()}</p>
        <p>Check the admin panel for more details.</p>
      `;
    await sendEmail(process.env.ADMIN_EMAIL, "New Order Received", adminMessage);

    res.status(201).json(order);
  } catch (err) {
    await session.abortTransaction(); // Rollback transaction on error
    session.endSession();
    res.status(500).json({ error: err.message });
  }
};



// route to validate cart items
module.exports.validateCartPost = async (req, res) => {
  try {
    const { items } = req.body
    if (!items || items.length <= 0) {
      return res.status(400).json({ error: "cart items can't be empty!" })
    } else {
      const unavailableItems = [];
      for (const item of items) {
        const food = await Food.findById(item.id);
        if (!food) {
          unavailableItems.push({ name: food?.name, id: food._id, reason: `This food was not found!` });
        }
        if (food.quantity < item.quantity) {
          unavailableItems.push({ name: food.name, id: food._id, reason: `only ${food.quantity} Plates remaining!` })
        }
        if (!food.isAvailable) {
          unavailableItems.push({ name: food.name, id: food._id, reason: `This item is not available right now!` })
        }
        if (food.price !== item.price) {
          unavailableItems.push({ name: food.name, id: food._id, reason: `new price for ${food.name} is ${food.price}!` })
        }
      }
      if (unavailableItems.length > 0) {
        return res.status(400).json({ unavailableItems });
      } else {
        return res.status(200).json({ message: "all cart items are available" })
      }
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
//   PATCH / PUT ROUTES
module.exports.editOrderPatch = async (req, res) => {
  try {
    const item = await Order.findById(req.params.id)
    if (!item || item === null) {
      res.status(404).json({ error: 'the order was not found' })
    } else {
      const { paymentStatus, orderStatus } = req.body
      const updatedOrder = await Order.findByIdAndUpdate(item._id, { $set: { orderStatus, paymentStatus } }, { new: true })
      res.status(200).json(updatedOrder)
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
module.exports.editFoodPatch = async (req, res) => {
  try {
    const item = await Food.findById(req.params.id)
    if (!item || item === null) {
      res.status(404).json({ error: 'the food was not found' })
    } else {
      const { name, description, price, category, quantity, isAvailable } = req.body
      const updatedFood = await food.findByIdAndUpdate(item._id, { $set: { name, description, price, category, quantity, isAvailable } }, { new: true })
      req.io.emit("foodUpdated", { action: "edit", food: updatedFood })
      res.status(200).json({ message: 'food updated succesfully' })
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
// DELETEROUTES
module.exports.deleteFoodDelete = async (req, res) => {
  try {
    console.log(req.params.id)
    const item = await Food.findById(req.params.id)
    if (item !== null) {
      await Food.findByIdAndDelete({ _id: item._id })
      req.io.emit("foodUpdated", { action: "delete", foodId: item._id })
      res.status(204).json({ message: 'food deleted succesfully!' })
    } else {
      res.status(404).json({ error: 'oops the food was not found!' })
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

module.exports.deleteOrderDelete = async (req, res) => {
  try {
    const item = await Order.findById(req.params.id)
    if (item !== null) {
      await Order.findByIdAndDelete(item._id)
      res.status(204).json({ message: 'order deleted succesfully!' })
    } else {
      res.status(404).json({ error: 'oops the order was not found!' })
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
