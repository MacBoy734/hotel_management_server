const express = require('express')
const {authenticateUser, checkIfIsAdmin} = require('../middleware/auth')
const { addFoodsPost, allFoodsGet, foodGet, editFoodPatch, deleteFoodDelete, searchFoodsGet, checkOutPost, allOrdersGet, validateCartPost } = require('../controllers/foods_controller')

const router = express.Router()

// GET ROUTES
router.get('/', allFoodsGet)
router.get('/orders', authenticateUser, allOrdersGet)
router.get('/search', searchFoodsGet)
router.get('/:id', foodGet)


// POST ROUTES
router.post('/addfood', authenticateUser, checkIfIsAdmin, addFoodsPost)
router.post('/checkout', authenticateUser, checkOutPost)
router.post('/validatecart', validateCartPost)

// PUT/PATCH ROUTES
router.patch('/editfood/:id', authenticateUser, checkIfIsAdmin, editFoodPatch)

// DELETE ROUTES
router.delete('/deletefood/:id', authenticateUser, checkIfIsAdmin, deleteFoodDelete)

module.exports = router