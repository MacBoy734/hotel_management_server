const mongoose = require ('mongoose')
const bcrypt = require ('bcryptjs')
const Order = require('./order')

const { Schema } = mongoose

const userSchema = new Schema({
  username: {
    type: String,
    required: true,
    lowercase: true,
    unique: [true, 'this username is already taken!'],
    maxlength: 10
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  email: {
    type: String,
    required: [true, 'please enter email'],
    unique: [true, 'this email is already taken!'],
    maxlength: 40
  },
  password: {
    type: String,
    required: [true, 'please enter password']
  },
  phone: {
    type: Number,
    required: [true, 'please enter phone number!']
  }, 
  orderHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true }]
}, {timestamps: true})

// HASHING THE PASSWORD BEFORE SAVING
userSchema.pre('save', async function(next){
  if (!this.isModified('password')) return next()
  let salt = await bcrypt.genSalt()
  this.password = await bcrypt.hash(this.password, salt)
  next()
})

// SETTING UP STATICS FUNCTIONS
userSchema.statics.login = async function (username, password){
  username = username.toLowerCase()
  const user = await this.findOne({username})
  if(user){
    const iscorrect = await bcrypt.compare(password, user.password)
    if(iscorrect){
     return user
    }else{
       throw Error('incorrect password!')
    }
  }
  throw Error('user not registered yet!')
}

module.exports = mongoose.model('User', userSchema)