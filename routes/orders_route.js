const express = require('express')
const router = express.Router()
const {authenticateUser, checkIfIsAdmin} = require('../middleware/auth')
const {allOrdersGet, editOrderPatch, deleteOrderDelete} = require('../controllers/orders_controller')


// GET ROUTES
router.get('/', authenticateUser, checkIfIsAdmin, allOrdersGet)


// PUT / PATCH ROUTES
router.patch('/editorder/:id', authenticateUser, checkIfIsAdmin, editOrderPatch)

// DELETE ROUTES
router.delete('/deleteorder/:id', authenticateUser, checkIfIsAdmin, deleteOrderDelete)


module.exports = router