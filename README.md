# Serverless to API migration

The source in this repository will contain source code from the `irys311-prisma-backend` in ExpressJS format instead of a serverless infrastructure.


---

## Workflow

High-level overview of the assignments of this migration.

1. ~~ Create database connection file with Prisma. ~~
2. ~~ Create app.js file where API will be written. ~~
3. ~~ Create function file(s) to generalize re-useable pieces of code into JS functions. ~~
4. ~~ Devs will create one (1) branch per service. ~~ (14 / 14 branches total) 
5. ~~ Said branch will add a .js file to the routes directory named `<service>.js` with all necessary routes for that service. ~~
6. ~~ Devs will follow structure provided by `api_mapping_templates/*.vtl` and `serverless.yml` in that service. ~~

       * Beto will change the order of routes of type `<service>/projects/**` in front end(0 / 14 branches total) 
    
       * Routes that have been changed will be marked with ** changed route ** for easy navaigation
       * `Ctrl+F` "CHANGED" to find in file

 
7. ~~ Devs will create a pull request with `main` once the micro-service is fully integrated to the local API. ~~


** DEVS ARE TO MAKE SMALL COMMITS AND COMMIT AT LEAST ONCE PER FUNCTION. ** 

---

## App installation (local)

1. Run `git clone URL`
2. Run `cd irys-express-API-backend`
3. Run `npm install`

## DB installation 
 ** THE NEW SETUP INCLUDES ONLY ONE `.env` FILE LOCATED IN THE ROOT DIRECTORY **
 
   ** this is managed with dotenv module
 
 ** for new swagger feature, include `DATABASE_URL` in the .env in the `/`(root) directory **
 
1. Run `npx introspect`
2. Run `npx generate`

## Running the app in debug mode 

Too run you must be in the root directory. 

`DEBUG=irys-express-api-backend:* npm start`

or 

`npm run debug`

--- 
## Docker Setup

1. Build the images with the provided dockerfiles 

       1. docker build -t **username**/irys-express-dev:local-db ./
       2. docker build -t `username`/irys-db:prod -f Dockerfile.postgres ./
       
       * TAGS are of the form: <*docker* username>/<image-name>:<image version/tag>
            
       * eg: `docker-official/node:16-buster-slim`
       
       *  ** use <docker-user>/irys-express:<db-location> **
       * This is because when you build an image the code is 'frozen' -  unless we mount it to a volume.  In our case, this is a good thing because we can snaposhot the App using different databse URLs for testing purposes. Just configure the `/prisma` accordingly and build a new image under a different tag indicative of the database location

2. Run `docker volume create `irysPostgresData`

3. Firt-time running command  ** base run command: `docker run [OPTIONS] <image-TAG>` **
       1. To run the application
       
       
          ```bash
          docker run -d -t \ 
          --name irysAPIv1-<db-location> \
          -p 0.0.0.0:3344:3000 \ 
          --env-file=./.env \
          <docker-username>/irys-express-dev:local-db
          ``` 

       
       2. To run a containarized database
       
          ```bash
          docker run -d -t \
          --name IrysDB \
          --mount src=irysPostgresData,dst=/var/lib/postgresql/data 
          -v ./docker-scripts/init-db/init_docker_postgres.sh:/docker-entrypoint-initdb.d/init_docker_postgres.sh \
          -p=0.0.0.0:5432:5432 \
          --env-file=./.env \
          <dokcer-username>/irys-db:1 

          ```
  
       * This command is where you *name* the container with the `--name` flag 
       * Make sure firewall rules in the VM allow outside access through the port you assign on the host machine
       * -p 0.0.0.0:$HOST_PORT:$CONTAINER_PORT
       
 4. Stop the docker container with `docker stop <container-name>`
 
 
 5. Restart the container with `docker start <container-name>`
 
 

---

### Resources 

- [ExpressJS Docs](https://expressjs.com/en/4x/api.html)
- [ExpressJS Guide](https://expressjs.com/en/guide/routing.html)
