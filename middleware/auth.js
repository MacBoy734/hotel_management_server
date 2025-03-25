const jwt = require('jsonwebtoken')

// MIDDLEWARE TO CHECK IF THE USER IS LOGGED IN
module.exports.authenticateUser = (req, res, next) => {
    let token = req.cookies.jwt
    if(token){
      jwt.verify(token, process.env.JWT_COOKIE_SECRET, (err, decodedtoken) => {
        if(err){
            res.status(403).json({error: 'your session has expired, login again!'})
        }else{
            req.user = decodedtoken
            next()
        }
      })
    }else{ 
        res.status(403).json({error: 'login a fresh to view this resource!'})
    }
}

// MIDDLEWARE TO CHECK IF USER IS AN ADMIN
module.exports.checkIfIsAdmin = (req, res, next) => {
    const user = req.user
    if (!user.isAdmin) {
        return res.status(403).json({ error: "you need to be an admin to perfom this action!" })
    }
    next()
}

