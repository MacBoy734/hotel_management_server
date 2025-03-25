const express = require('express')
const router = express.Router()
const {authenticateUser, checkIfIsAdmin} = require('../middleware/auth')
const {registerPost, loginPost, allUsersGet, changeRoleGet, newsletterPost, userOrdersGet} = require('../controllers/users_controller')

// GET ROUTES
router.get('/', authenticateUser, checkIfIsAdmin, allUsersGet)
router.get('/:id/orders', authenticateUser, userOrdersGet)
router.get('/:id/edit', authenticateUser, checkIfIsAdmin, changeRoleGet)

// POST ROUTES
router.post('/login', loginPost)
router.post('/register', registerPost)
router.post('/newsletter', newsletterPost)

// PATCH/PUT ROUTES


// DELETE ROUTES

module.exports = router