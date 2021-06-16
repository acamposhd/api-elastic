//Importing middlewares
let tokenVerify = require("./tokenVerify");

// Array declaration for middlewares
process.middlewares = [tokenVerify];
