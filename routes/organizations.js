const express = require("express");
const prisma = require("./db");
const router = express.Router();
const { successResponse, errorResponse } = require("../helpers/apiResponser");

//updateOrganization
router.put("/:id", process.middlewares, async (req, res) => {
    const { params, body } = req;
    try {
        const id = +params.id;
        if (!Number.isInteger(id)) throw new Error("Missing organization id");
        let data = body;
        data.complete = true;
        const organization = await prisma.organization.update({
            where: { id },
            data,
        });
        return successResponse({
            res,
            body: organization,
        });
    } catch (error) {
        console.log("Error updating the organization:", error);
        return errorResponse({ res, error });
    } 
});

module.exports = router;
