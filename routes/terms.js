const express = require("express");
const prisma = require("./db");
const router = express.Router();
const { successResponse, errorResponse } = require("../helpers/apiResponser");

//getAppTerms
router.get("/", async (req, res) => {
    try {
        const actualTerms = await prisma.$queryRaw(
            "select id, version, html_text from terms where version = (select max(version) from terms)"
        );
        return successResponse({
            res,
            body: actualTerms,
        });
    } catch (error) {
        console.log("Error getting lastest terms and condition", error);
        return errorResponse({ res, error });
    } finally {
        await prisma.$disconnect();
    }
});

module.exports = router;
