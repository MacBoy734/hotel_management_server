const express = require('express')
const router = express.Router()
const {authenticateUser, checkIfIsAdmin} = require('../middleware/auth')
const {registerPost, loginPost, allUsersGet, changeRoleGet, newsletterPost, userOrdersGet, forgotPasswordPost, resetPasswordPost, siteDetailsGet, logoutGet} = require('../controllers/users_controller')

// GET ROUTES
router.get('/', authenticateUser, checkIfIsAdmin, allUsersGet)
router.get('/logout', logoutGet)
router.get('/:id/orders', authenticateUser, userOrdersGet)
router.get('/:id/edit', authenticateUser, checkIfIsAdmin, changeRoleGet)
router.get('/admin/sitedetails', authenticateUser, checkIfIsAdmin, siteDetailsGet)

// POST ROUTES
router.post('/login', loginPost)
router.post('/register', registerPost)
router.post('/newsletter', newsletterPost)
router.post('/forgotpassword', forgotPasswordPost)
router.post('/resetpassword', resetPasswordPost)

// PATCH/PUT ROUTES


// DELETE ROUTES

module.exports = router