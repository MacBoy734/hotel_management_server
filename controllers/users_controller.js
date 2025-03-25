const jwt = require('jsonwebtoken')
const User = require('../models/user')
const Newsletter = require('../models/newsletter')
const nodemailer = require('nodemailer')
const { body, validationResult } = require('express-validator')


// CREATE TOKEN FUNCTION

const createtoken = (id, username, isAdmin) => {
    return jwt.sign({ id, username, isAdmin }, process.env.JWT_COOKIE_SECRET)
}
// GET USERS

// GET ALL USERS ROUTE
module.exports.allUsersGet = async (req, res) => {
    try {
        const users = await User.find({}, { password: 0 })
        res.status(200).json(users)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

// CHANGE USERS ROLE
module.exports.changeRoleGet = async (req, res) => {
    try {
        const { id } = req.params
        if (!id) {
            return res.status(400).json({ error: 'missing or invalid id' })
        }
        const user = await User.findOne({ _id: id })
        if (!user || user === null) {
            return res.status(404).json({ error: 'the user cannot be found' })
        } else {
            const updatedUser = await User.findByIdAndUpdate(user._id, { $set: { isAdmin : user.isAdmin ? false : true } }, { new: true })
            res.status(200).json(updatedUser)
        }

    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

module.exports.userOrdersGet = async (req, res) => {
    try {
        const { id } = req.params
        console.log(id)
        if (!id) {
            return res.status(400).json({ error: 'please include the id!' })
        }
        const user = await User.findById(id)
        if (!user) {
            return res.status(404).json({ error: 'the user was not found' })
        } else {
            userOrders = await User.findById(user._id).select('orderHistory').populate({ path: 'orderHistory', select: '-updatedAt -user -shippingAddress -email' })
            console.log(userOrders)
            res.status(200).json(userOrders)
        }
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}


// POST ROUTES

// LOGIN ROUTE
module.exports.loginPost = [
    body('username').trim().escape(),
    body('password').trim().escape()
    , async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }
        try {
            let { username, password } = req.body
            user = await User.login(username, password)
            let token = createtoken(user._id, user.username, user.isAdmin)
            res.cookie('jwt', token, {
                maxAge: 3600000 * 120,
                httpOnly: true,
                sameSite: "none",
                secure: process.env.IS_PRODUCTION,
                path: '/'
            })
            if (user) res.status(200).json(user)
        } catch (err) {
            res.status(401).json({ error: err.message })
        }
    }]

module.exports.registerPost = [
    body('username').trim().escape(),
    body('password').trim().escape(),
    body('phone').trim().escape(),
    body('email').isEmail().normalizeEmail()
    , async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }
        const { username, password, email, phone } = req.body
        if (!username || !password || !email || !phone) return res.status(400).json({ error: "please enter all the details!" })
        const newUser = new User({
            username,
            password,
            email,
            phone
        })
        try {
            const userExists = await User.findOne({ username })
            const emailExists = await User.findOne({ email })
            if (userExists !== null) {
                return res.status(409).json({ error: 'the username is already taken!' })
            }
            if (emailExists !== null) {
                return res.status(409).json({ error: 'the email is already registered!' })
            }
            const user = await newUser.save()

            // send email to the user
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
            })
            const mailOptions = {
                from: `"Mac Boy" <${process.env.EMAIL_USERNAME}>`,
                to: email,
                subject: `Welcome To Our Store!`,
                html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
  <div style="background: #ff6600; padding: 20px; text-align: center; color: white;">
    <h1 style="margin: 0;">Welcome to <strong>Mac Boy Store</strong>! 🎉</h1>
  </div>

  <div style="padding: 20px; color: #333;">
    <p style="font-size: 18px;">Hey <strong>${user.username}</strong>,</p>
    
    <p style="font-size: 16px;">
      You just joined the best place to find amazing deals and top-notch products! 🚀  
      We're thrilled to have you, and to kick things off, here's a **special welcome discount** just for you!
    </p>

    <p style="text-align: center;">
      <a href="https://macboystore.netlify.app/products" style="background: #ff6600; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-size: 18px; display: inline-block; font-weight: bold;">
        Start Shopping 🛒
      </a>
    </p>

    <p style="font-size: 16px;">
      Got questions? Our support team is here 24/7 to assist you.  
      Simply reply to this email or visit our <a href="https://macboystore.netlify.app/help/contactsupport" style="color: #ff6600; text-decoration: none;">Help Center</a>.
    </p>

    <p style="text-align: center; font-size: 14px; color: gray;">
      Happy Shopping! ❤️<br>
      <strong>Mac Boy Store Team</strong>
    </p>
  </div>

  <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: gray;">
    You received this email because you signed up on <strong>Mac Boy Store</strong>.  
    If this wasn’t you, please <a href="#" style="color: #ff6600; text-decoration: none;">unsubscribe here</a>.
  </div>
</div>
`

            }


            transporter.sendMail(mailOptions, (error, Info) => {
                if (error) {
                    console.log(error.message)
                    return res.status(500).json({ error: 'There was an error sending the reset email' })
                }
            })
            let token = createtoken(user._id, user.username, user.isAdmin)
            res.cookie('jwt', token, {
                path: '/',
                httpOnly: true,
                sameSite: "none",
                secure: process.env.IS_PRODUCTION,
                maxAge: 3600000 * 120
            })
            if (user) res.status(201).json(user)
        } catch (error) {
            res.status(500).json({ error: error.message })
        }

    }]

    module.exports.newsletterPost = async (req, res) => {
        try {
            const { email } = req.body
            if (!email) return res.status(400).json({ error: 'Email is required' })
    
            const exists = await Newsletter.findOne({ email })
            if (exists) return res.status(400).json({ error: "You're already subscribed!" })
    
            await Newsletter.create({ email })
    
            return res.status(200).json({ message: "Subscribed successfully!" })
        } catch (err) {
            return res.status(500).json({ error: err.message })
        }
    }
    module.exports.sendNewsletterPost = async (req, res) => {
        const { subject, body } = req.body;
    
        if (!subject || !body) {
            return res.status(400).json({ error: "please enter all details" })
        }
        try {
            const users = await Newsletter.find().select('email -_id');
            if (users.length > 0) {
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
                await Promise.all(
                    users.map(async (user) => {
                        const mailOptions = {
                            from: `"Mac Boy" <${process.env.EMAIL_USERNAME}>`,
                            to: user.email,
                            subject,
                            text: body,
                        };
    
                        await transporter.sendMail(mailOptions);
                    })
                );
                res.status(200).json({ message: "Newsletter sent successfully!" });
            } else {
                return res.status(400).json({ error: 'there is no enough users!' })
            }
        } catch (error) {
            res.status(500).json({ error: "Failed to send the newsletter." });
        }
    }

    module.exports.forgotPasswordPost = async (req, res) => {
        const email = req.body.email
        try {
            const user = await User.findOne({ email })
            if (!user) return res.status(404).json({ error: 'this email is not registered!' })
            const token = jwt.sign({ id: user._id }, process.env.JWT_COOKIE_SECRET, { expiresIn: '10m' })
            const resetUrl = `https://${process.env.CLIENT_URL}/auth/resetpassword?token=${token}`
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
            })
    
            const mailOptions = {
                from: `"Local Eatery" <${process.env.EMAIL_USERNAME}>`,
                to: email,
                subject: `Password Reset`,
                html: `
                <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; padding: 20px; background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 8px;">
                    <h2 style="color: #0275d8; text-align: center;">Reset Your Password</h2>
                    <p>Hello ${user.username},</p>
                    <p>Hey We are so sorry that you lost your password. Click the button below to reset your password. <strong>This link will expire in 10 minutes.</strong></p>
                    <div style="text-align: center; margin: 20px 0;">
                        <a href="${resetUrl}" style="background-color: #0275d8; color: #fff; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 5px;">
                            Reset Password
                        </a>
                    </div>
                    <p>If the button above doesn’t work, you can also click the link below:</p>
                    <p style="word-break: break-word; color: #0275d8;">
                        <a href="${resetUrl}" style="color: #0275d8; text-decoration: none;">${resetUrl}</a>
                    </p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                    <p style="font-size: 0.9rem; color: #666;">
                        If you did not request a password reset, you can safely ignore this email.
                    </p>
                    <br>
                    <small>This is an automated response! Please don't reply to this email.</small>
                    <br>
                    <p style="font-size: 0.9rem; color: #666;">Thank you,<br>The Eatery Team</p>
                </div>
            `
    
            }
    
            // Send the confirmation email
            transporter.sendMail(mailOptions, (error, Info) => {
                if (error) {
                    console.log(error.message)
                    res.status(500).json({ error: 'There was an error sending the reset token' })
                } else {
                    res.status(200).send({ message: "link succesfully sent!" })
                }
            })
        } catch (err) {
            res.status(500).json({ error: err.message })
        }
    }
    
    module.exports.resetPasswordPost = async (req, res) => {
        const { password, token } = req.body
        if (!token) return res.status(400).json({ error: 'Token is required' })
        if (!password) return res.status(400).json({ error: 'Password is required!' })
    
        try {
            const decodedToken = jwt.verify(token, process.env.JWT_COOKIE_SECRET)
            const user = await User.findById(decodedToken.id)
            if (!user) return res.status(404).json({ error: 'User not found' })
    
    
            user.password = password
            await user.save()
    
            res.status(200).json({ message: 'Password changed successfully, use it to login' })
        } catch (error) {
            res.status(401).json({ error: 'Invalid or expired Link!' })
        }
    }