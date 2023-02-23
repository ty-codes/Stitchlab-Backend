const express = require('express')
const bodyParser = require('body-parser');
const cors = require("cors");
require("dotenv").config();
const randomString = require("randomized-string");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const jwtDecode = require("jwt-decode");

const app = express();

app.use(bodyParser.json())
app.use(bodyParser.urlencoded())
app.use(cors())
var port = process.env.PORT || 8000;
app.use(express.static(__dirname));


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

const randomId = new randomString.generate({
  charset: "alphanumeric",
  length: 24,
})

// The database to use
const dbName = "users";

// register
app.post('/public/users', async (req, res) => {

  const tailorPlaceholder = {
    email: "titoadeoye@gmail.com",
    firstname: "bolatito",
    lastname: "adeoye",
    secret: "bolinco123",
    userType: "tailor",
    phoneNumber: "00000000000"
  }

  const subPlaceholder = {
    email: "danieljohnson@gmail.com",
    firstname: "daniel",
    lastname: "johnson",
    secret: "daniel123",
    userType: "subscriber",
    phoneNumber: "00000000000"
  }
  const { email, firstname, lastname, secret, userType, phoneNumber } = req.body;

  if (email && firstname && lastname && secret && userType && phoneNumber) {
    var randomId = randomString.generate({
      charset: "alphanumeric",
      length: 24,
    });

    var saltRounds = email.length;

    var hash = await bcrypt.hash(secret, saltRounds);
    try {
      await client.connect();
      const db = client.db(dbName);
      const col = db.collection("users");
      var emailExists = await col?.findOne({ email: email })

      if (!emailExists) {
        // Construct a document                                                                                                                                                              
        let newDocument = hash && {
          "id": randomId,
          "isGoogle": secret ? false : true,
          "isFb": secret ? false : true,
          "status": "pending",
          "dateCreated": new Date(),
          email: email,
          firstname: firstname,
          lastname: lastname,
          secret: hash,
          userType: userType,
          phoneNumber: phoneNumber,
        }
        // res.send(newDocument)
        // Insert a single document, wait for promise so we can read it back

        const p = await col.insertOne(newDocument);

        res.status(200).send(p)
      } else {
        res.status(400).send({ message: "Email already exists" })
      }

    } catch (err) {
      console.log(err.stack);
    }

    finally {
      // await client.close();
    }

  }
  else {
    res.status(400).json({ message: "Incorrect data" })
  }
})

// login
app.post('/public/users/authenticate', async (req, res) => {
  const { email, secret } = req.body;
  if (email && secret) {
    var saltRounds = email.length;

    var hash = await bcrypt.hash(secret, saltRounds);
    try {
      await client.connect();
      const db = client.db(dbName);
      const col = db.collection("users");
      var emailExists = await col?.findOne({ email: email });
      if (emailExists) {
        console.log(emailExists, emailExists._id.toString());
        const { secret: secrethash } = emailExists;
        bcrypt.compare(secret, secrethash).then((response) => {
          if (response) {
            const payload = {
              sub: emailExists?._id?.toString(),
              iat: new Date().getTime()
            }

            const token = jwt.sign(payload, process.env.SECRET_KEY);
            res.status(200).json({ token })
          }
          else {
            res.status(400).json({ message: "Invalid credentials" })
          }
        })
      } else {
        res.status(400).send({ message: "Email doesn't exist" })
      }

    } catch (err) {
      console.log(err)
    }
  } else {
    res.status(400).json({ message: "Incorrect data" })
  }
})


// authenticated

// get user details
app.get('/users/:tailorId', async (req, res) => {
  const reqId = req.params.tailorId;

  const bearer = req?.headers?.authorization;

  if (bearer) {
    const [, token] = bearer ? bearer.split(" ") : res.status(401).json({ message: "Unauthorized. Access is denied due to invalid credentials." })
      ;
    const payload = token ? jwt.verify(token, process.env.SECRET_KEY) : null;
    if (!!payload) {
      const decoded = jwtDecode(token);
      console.log(decoded.sub)
      const tailor = reqId === decoded.sub ? decoded.sub : null;

      try {
        await client.connect();
        const db = client.db(dbName);
        const col = db.collection("users");

        tailor ?
          col?.findOne({ _id: ObjectId(tailor) })
            .then(async (response) => {
              if (response) {
                console.log(response, 'customers');
                res.status(200).json({ data: response });
              } else if ((!response)) {
                console.log(response, "no customers")
                res.status(200).json({ data: [] });
              }
            })
            .catch(err => {
              res.status(401).json({ message: "Unauthorized. Access is denied due to invalid credentials." })
            })
          : res.status(400).json({ message: "User does not exist" })

      } catch (err) {
        res.status(400).json({ message: "Something went wrong" })
      }


    } else {
      res.status(401).json({ message: "Unauthorized. Access is denied due to invalid credentials." })

    }
  } else {
    res.status(401).json({ message: "Unauthorized. Access is denied due to invalid credentials." })

  }

})

// add of customer
app.post('/users/:tailorId/customer', async (req, res) => {
  const reqId = req.params.tailorId;

  const bearer = req?.headers?.authorization;

  if (bearer) {
    const [, token] = bearer ? bearer.split(" ") : res.status(401).json({ message: "Unauthorized. Access is denied due to invalid credentials." })
      ;
    const payload = token ? jwt.verify(token, process.env.SECRET_KEY) : null;
    const { style, price, firstname, lastname, dateCreated, dateDue, status } = req.body;
    if (!!payload && firstname && lastname && style && price && dateCreated && dateDue && status) {
      const decoded = jwtDecode(token);
      const tailor = reqId === decoded.sub ? decoded.sub : null;
      const customer = {
        cid: ObjectId().toString(),
        ...req.body
      }


      try {
        await client.connect();
        const db = client.db(dbName);
        const col = db.collection("users");
        tailor ? col?.findOne({ _id: ObjectId(tailor) })
          .then(async (response) => {
            if (response && !response.customers) {
              console.log(response?.customers);
              var customerArray = [];
              customerArray.push(customer);
              const updated = await col?.updateOne({ _id: ObjectId(tailor) }, { $set: { customers: customerArray } })
              updated && res.status(200).send({ message: "Customer list has been updated" })
            } else if (response && response.customers) {
              console.log(response?.customers);
              var customerArray = response?.customers;
              customerArray.push(customer);
              const updated = await col?.updateOne({ _id: ObjectId(tailor) }, { $set: { customers: customerArray } })
              updated && res.status(200).send({ message: "Customer list has been updated" })
            } else if ((!response)) {
              res.status(400).json({ message: "Account doesn't exist." });
            }
          })
          .catch(err => {
            res.status(401).json({ message: "Unauthorized. Access is denied due to invalid credentials." })
          })
          : res.status(400).json({ message: "User does not exist" })


      } catch (err) {
        res.status(400).json({ message: "Something went wrong" })
      }


    } else {
      res.status(401).json({ message: "Unauthorized. Access is denied due to invalid credentials." })

    }
  } else {
    res.status(401).json({ message: "Unauthorized. Access is denied due to invalid credentials." })

  }

})

// get list of customers
app.get('/users/:tailorId/customers', async (req, res) => {
  const reqId = req.params.tailorId;

  const bearer = req?.headers?.authorization;

  if (bearer) {
    const [, token] = bearer ? bearer.split(" ") : res.status(401).json({ message: "Unauthorized. Access is denied due to invalid credentials." })
      ;
    const payload = token ? jwt.verify(token, process.env.SECRET_KEY) : null;
    if (!!payload) {
      const decoded = jwtDecode(token);
      const tailor = reqId === decoded.sub ? decoded.sub : null;

      try {
        await client.connect();
        const db = client.db(dbName);
        const col = db.collection("users");

        tailor ?
          col?.findOne({ _id: ObjectId(tailor) })
            .then(async (response) => {
              if (response.customers) {
                console.log(response.customers, 'customers');
                res.status(200).json({ data: response.customers });
              } else if ((!response.customers)) {
                console.log(response.customers, "no customers")
                res.status(200).json({ data: [] });
              }
            })
            .catch(err => {
              res.status(401).json({ message: "Unauthorized. Access is denied due to invalid credentials." })
            })
          : res.status(400).json({ message: "User does not exist" })

      } catch (err) {
        res.status(400).json({ message: "Something went wrong" })
      }


    } else {
      res.status(401).json({ message: "Unauthorized. Access is denied due to invalid credentials." })

    }
  } else {
    res.status(401).json({ message: "Unauthorized. Access is denied due to invalid credentials." })

  }

})

// add customer measurement
app.post('/users/:tailorId/measurements', async (req, res) => {
  const reqId = req.params.tailorId;

  const bearer = req?.headers?.authorization;

  if (bearer) {
    const [, token] = bearer ? bearer.split(" ") : res.status(401).json({ message: "Unauthorized. Access is denied due to invalid credentials." })
      ;
    const payload = token ? jwt.verify(token, process.env.SECRET_KEY) : null;
    // const reqBodyCompleted =  arr.every(item => obj.hasOwnProperty(item))
    const { cid, ...others } = req.body;
    if (!!payload && cid) {
      console.log(cid, "cid");
      const decoded = jwtDecode(token);
      const tailor = reqId === decoded.sub ? decoded.sub : null;

      try {
        await client.connect();
        const db = client.db(dbName);
        const col = db.collection("users");
        const measurement = { ...others }
        tailor ? col?.findOne({ _id: ObjectId(tailor) })
          .then(async (response) => {
            const cidAavailable = await db?.collection("measurements")?.findOne({ cid: cid });
            console.log(cidAavailable)
            if (cidAavailable) {
              const updated = await db?.collection("measurements")?.insertOne({ cid: cid, measurements: measurement});

              res.status(200).send({data: updated})
            } else {
              res.status(500).send({messge: "Could not add data"})
            }
            // !cidAavailable && await db?.collection("measurements")?.insertOne({ cid: cid, measurements: measurement})
              // : await db?.collection("measurements")?.findOneAndUpdate({cid: cid}, {measurements: measurement})
// if(cidAavailable) {
//                 // : await db?.collection("measurements")?.findOneAndUpdate({cid: cid}, {measurements: measurement})
// } else {
//   await db?.collection("measurements")?.insertOne({ cid: cid, measurements: measurement})
// }
          })
          .catch(err => {
            res.status(401).json({ message: "Unauthorized. Access is denied due to invalid credentials.", error: err })
          })
          : res.status(400).json({ message: "User does not exist" })


      } catch (err) {
        res.status(400).json({ message: "Something went wrong" })
      }


    } else {
      res.status(401).json({ message: "paylodUnauthorized. Access is denied due to invalid credentials." })

    }
  } else {
    res.status(401).json({ message: "bearerUnauthorized. Access is denied due to invalid credentials." })

  }

})

// edit customer measurement
app.put('/users/:tailorId/measurements', async (req, res) => {
  const reqId = req.params.tailorId;

  const bearer = req?.headers?.authorization;

  if (bearer) {
    const [, token] = bearer ? bearer.split(" ") : res.status(401).json({ message: "Unauthorized. Access is denied due to invalid credentials." })
      ;
    const payload = token ? jwt.verify(token, process.env.SECRET_KEY) : null;
    // const reqBodyCompleted =  arr.every(item => obj.hasOwnProperty(item))
    const { cid, ...others } = req.body;
    if (!!payload && cid) {
      const decoded = jwtDecode(token);
      const tailor = reqId === decoded.sub ? decoded.sub : null;

      try {
        await client.connect();
        const db = client.db(dbName);
        const col = db.collection("users");
        const measurement = others.measurements;
        
        tailor ? col?.findOne({ _id: ObjectId(tailor) })
          .then(async (response) => {
            const cidAavailable = await db?.collection("measurements")?.findOne({ cid: cid });
            console.log(cidAavailable, "vocds", Boolean(cidAavailable))
            if (cidAavailable) {
          
              var editedDocument = {...cidAavailable.measurements, ...measurement}
              console.log(editedDocument)
              const updated = db?.collection("measurements")?.updateMany({cid: cid},  { $set: { measurements: editedDocument }})
              res.status(200).send({messge: "Updated successfully"})
              
            } else {
              res.status(500).send({messge: "Could not update data"})
            }
          })
          .catch(err => {
            console.log(err)
            res.status(401).json({ message: "Unauthorized. Access is denied due to invalid credentials.", error: err })
          })
          : res.status(400).json({ message: "User does not exist" })


      } catch (err) {
        res.status(400).json({ message: "Something went wrong" })
      }


    } else {
      res.status(401).json({ message: "paylodUnauthorized. Access is denied due to invalid credentials." })

    }
  } else {
    res.status(401).json({ message: "bearerUnauthorized. Access is denied due to invalid credentials." })

  }

})

console.log(new Date().getDate());

// get customer measurements
app.get('/users/:tailorId/measurements/:customerId', async (req, res) => {
  const reqId = req.params.tailorId;
const cid = req.params.customerId;

  const bearer = req?.headers?.authorization;

  if (bearer) {
    const [, token] = bearer ? bearer.split(" ") : res.status(401).json({ message: "Unauthorized. Access is denied due to invalid credentials." })
      ;
    const payload = token ? jwt.verify(token, process.env.SECRET_KEY) : null;
    if (!!payload && cid) {
      const decoded = jwtDecode(token);
      const tailor = reqId === decoded.sub ? decoded.sub : null;

      try {
        await client.connect();
        const db = client.db(dbName);
        const col = db.collection("users");
        tailor ? col?.findOne({ _id: ObjectId(tailor) })
          .then(async (response) => {
            const customer = await db?.collection("measurements")?.findOne({ cid: cid });
            console.log(customer.measurements)
            res.status(200).send({data: customer.measurements || []})
          })
          .catch(err => {
            res.status(401).json({ message: "Unauthorized. Access is denied due to invalid credentials.", error: err })
          })
          : res.status(400).json({ message: "User does not exist" })


      } catch (err) {
        res.status(400).json({ message: "Something went wrong" })
      }


    } else {
      res.status(401).json({ message: "Unauthorized. Access is denied due to invalid credentials." })

    }
  } else {
    res.status(401).json({ message: "Unauthorized. Access is denied due to invalid credentials." })

  }

})

app.listen(port, () => {
  console.log(`server started. listening on ${port}`)
})
