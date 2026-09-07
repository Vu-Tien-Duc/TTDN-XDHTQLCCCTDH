const express = require('express');
const router = express.Router();
const { getAllUsers, getUserById, updateUser, deleteUser } = require('../controllers/user.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.put('/:id', authorizeRoles('admin', 'truongkhoa'), updateUser);
router.delete('/:id', authorizeRoles('admin'), deleteUser);

module.exports = router;
