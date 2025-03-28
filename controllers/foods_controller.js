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
      const foods = await Food.find({quantity: { $gt: 0 }})
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
      const allOrders = await Order.find().populate({path: 'user', select: 'username'})
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
    const { userId, items, address, postalCode, city, email, paymentMethod, phone } = req.body;
    try {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
  
      let totalAmount = 0;
      let orderItems = [];
  
      for (let item of items) {
        const food = await Food.findById(item.id);
        if (!food) {
          return res.status(404).json({ error: `Food with ID ${item.id} not found` });
        }
  
        // Calculate price and update stock
        totalAmount += food.price * item.quantity;
        orderItems.push({
          food: food._id,
          name: food.name,
          quantity: item.quantity,
          price: food.price
        });
  
        // Update stock (reduce by quantity)
        food.quantity -= item.quantity;
        await food.save();
      }
  
      // Create new order
      const order = new Order({
        user: user._id,
        items: orderItems,
        totalAmount,
        shippingAddress: address,
        paymentMethod,
        email,
        paymentStatus: 'Pending',
        orderStatus: 'Pending'
      });
  
      await order.save();
  
      user.orderHistory.push(order._id)
      await user.save()
      // Email to user
      const userMessage = `
      <h2>Order Confirmation</h2>
      <p>Thank you for placing your order, ${user.username}!</p>
      <h3 style="color: #333;">Order Details</h3>
      <p>Your order ID: ${order._id}</p>
      <p>Total: $${order.totalAmount}</p>
      <p>Date: ${new Date(order.createdAt).toLocaleString()}</p>
      <p>Payment method: ${order.paymentMethod}</p>
      <p>shipping address: ${order.shippingAddress}</p>
      <p>city of delivery: ${order.city}</p>
      <p>We will notify you when it's shipped.</p>
    `;
      await sendEmail(user.email, "Order Confirmation", userMessage);
  
      // Email to admin
      const adminMessage = `
      <h2>New Order Received</h2>
      <p>User: ${user.username} (${email})</p>
      <p>Order ID: ${order._id}</p>
      <p>Total: $${order.totalAmount}</p>
      <p>city of delivery: ${order.city}</p>
      <p>Payment method: ${order.paymentMethod}</p>
      <p>Check the admin panel for more details.</p>
    `;
      await sendEmail(process.env.ADMIN_EMAIL, "New Order Received", adminMessage)
      res.status(201).json(order);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

//   PATCH / PUT ROUTES
module.exports.editOrderPatch = async (req, res) => {
    try {
      const item = await Order.findById(req.params.id)
      if (!item || item === null) {
        res.status(404).json({ error: 'the order was not found' })
      } else {
        const { paymentStatus, orderStatus} = req.body
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
  