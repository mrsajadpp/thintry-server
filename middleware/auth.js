const jwt = require('jsonwebtoken');
const User = require("../model/user/model");
const { default: mongoose } = require('mongoose');

module.exports = {
    verifyToken: async (req, res, next) => {
        const token = req.header('Authorization');
        if (!token) return res.status(401).json({ error: 'Access denied' });
        try {
            const decoded = jwt.verify(token, process.env.SECRET_KEY);
            let user = await User.findOne({ _id: new mongoose.Types.ObjectId(decoded.user_id) }).lean();
            req.user_id = decoded.user_id;
            if (!user) return res.status(401).json({ error: 'Access denied' });
            next();
        } catch (error) {
            res.status(401).json({ error: 'Invalid token' });
        }
    },
    verifyAdmin: async (req, res, next) => {
        const token = req.header('Authorization');
        if (!token) return res.status(401).json({ error: 'Access denied' });
        try {
            const decoded = jwt.verify(token, 'gvxuser@$');
            let user = await User.findOne({ _id: new mongoose.Types.ObjectId(decoded.user_id) }).lean();
            req.user_id = decoded.user_id;
            if (!user) return res.status(401).json({ error: 'Access denied' });
            if (!user.admin) return res.status(401).json({ error: 'Access denied' });
            next();
        } catch (error) {
            res.status(401).json({ error: 'Invalid token' });
        }
    }
};