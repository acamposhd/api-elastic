const express = require("express");
const prisma = require("./db");
const router = express.Router();
const dates = require("../helpers/dates");
const { successResponse, errorResponse } = require("../helpers/apiResponser");

//listRolesByProject: ${file(serverless_functions/list_project_roles.yml)}
//*CHANGED* from /projects/:id/roles > to > /roles/projects/:id
router.get("/projects/:id", process.middlewares, async (req, res) => {
    const {params, body} = req;
    try {
        const project_id = +params.id;
        var queryParams = {}
        queryParams.take = body.offset || 100
        queryParams.where = {deleted : !true, project_id : project_id}
        if(body.from){
          queryParams.cursor = body.from
        }
    
        queryParams.select = {
            id : true, name : true, permission : true, deleted : true, 
            deleted_at : true, created_at : true
        }
        const roles = await prisma.role.findMany(queryParams);
    
        successResponse({
          res,
          body: roles,
        });

      } catch (error) {
        console.log("Error listing project roles:", error);
        errorResponse({
          res,
          error
        });
      }
})

module.exports = router