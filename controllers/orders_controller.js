const mongoose = require('mongoose')
const Order = require('../models/order')
//get all orders
module.exports.allOrdersGet = async (req, res) => {
    try {
      const allOrders = await Order.find().populate({path: 'user', select: 'username'})
      res.status(200).json(allOrders)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  }

//   update an order
module.exports.editOrderPatch = async (req, res) => {
    try {
      const item = await Order.findById(req.params.id)
      if (!item || item === null) {
        res.status(404).json({ error: 'the order was not found' })
      } else {
        const { paymentStatus, orderStatus} = req.body
        const updatedOrder = await Order.findByIdAndUpdate(item._id, { $set: { orderStatus, paymentStatus } }, { new: true })
        return res.status(200).json(updatedOrder)
      }
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  }
// delete an order
  module.exports.deleteOrderDelete = async (req, res) => {
    try {
      const item = await Order.findById(req.params.id)
      if (item !== null) {
        await Order.findByIdAndDelete(item._id)
        return res.status(204).json({ message: 'order deleted succesfully!' })
      } else {
        res.status(404).json({ error: 'oops the order was not found!' })
      }
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }