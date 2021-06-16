const express = require('express');

const router = express.Router();


/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

router.get('/getInfo', function(req, res, next) {
  user =   {
    name: 'Test123',
    email: 'email44@email.com',
    address: '123 Main St.',
    state: 'TX'
  };
  res.send(user);
});

module.exports = router;
