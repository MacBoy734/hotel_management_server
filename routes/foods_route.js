const express = require('express')
const {authenticateUser, checkIfIsAdmin} = require('../middleware/auth')
const { addFoodsPost, allFoodsGet, foodGet, editFoodPatch, deleteFoodDelete, searchFoodsGet, checkOutPost, allOrdersGet, editOrderPatch, deleteOrderDelete, validateCartPost } = require('../controllers/foods_controller')

const router = express.Router()

// GET ROUTES
router.get('/', allFoodsGet)
router.get('/orders', authenticateUser, checkIfIsAdmin, allOrdersGet)
router.get('/search', searchFoodsGet)
router.get('/:id', foodGet)


// POST ROUTES
router.post('/addfood', authenticateUser, checkIfIsAdmin, addFoodsPost)
router.post('/checkout', authenticateUser, checkOutPost)
router.post('/validatecart', validateCartPost)

// PUT/PATCH ROUTES
router.patch('/editfood/:id', authenticateUser, checkIfIsAdmin, editFoodPatch)
router.patch('/editorder/:id', authenticateUser, checkIfIsAdmin, editOrderPatch)

// DELETE ROUTES
router.delete('/deleteorder/:id', authenticateUser, checkIfIsAdmin, deleteOrderDelete)
router.delete('/deletefood/:id', authenticateUser, checkIfIsAdmin, deleteFoodDelete)

module.exports = router