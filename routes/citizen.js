var express = require("express");
var prisma = require("./db");
var router = express.Router();

// GET A CITIZENS NOTIFICATIONS BY ID //
router.get("/notification/:id", async function (req, res, next) {
  try {
    const id = +req.params.id;
    if (!Number.isInteger(id)) {
      throw new Error("Missing integer id");
    }
    const notifications = await prisma.user_message.findMany({
      where: { user_id: id, message_type: { id: 1 } },
      include: { message: true },
    });
    res.send({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: notifications,
    });
  } catch (error) {
    //More error management
    res.send({
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      message: {
        en: "Notifications could not be found. SE",
        es: "No se encontraron notificaciones para el usuario. SE",
      },
      body: req.body,
    });
  } finally {
    
  }
});

module.exports = router;
