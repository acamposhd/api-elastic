require('dotenv').config({path:'../.env'})

const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();

module.exports= prisma;
