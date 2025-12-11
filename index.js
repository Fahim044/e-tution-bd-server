const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app=express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
app.use(express.json());
app.use(cors());
const port=process.env.PORT || 4000;
const uri = `mongodb+srv://${process.env.db_username}:${process.env.db_password}@cluster0.gpbclj8.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

app.get('/',(req,res)=>{
res.send('E-TUTION BD Server is Running');
});

async function run() {
  try {
    const db=client.db('E_Tution_BD_DB');
    const usersCollection=db.collection('users');
    const tutionsCollection=db.collection('tutions');

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // users api
    app.get('/users',async(req,res)=>{
        const query={};
        const {email,role}=req.query;
        if(email)
        {
            query.email=email;
        }
        if(role)
        {
            query.role=role;
        }
        const options={sort:{createdAt:-1}};
        const result=await usersCollection.find(query,options).toArray();
        res.send(result);
    });
    app.post('/users',async(req,res)=>{
        const userInfo=req.body;
        userInfo.createdAt=new Date().toLocaleString();
        const userEmail=userInfo.email;
        // console.log('user Email: ',userEmail);
        const userExists=await usersCollection.findOne({email:userEmail});
        // console.log('userExists: ',userExists);
        if(userExists)
        {
            return res.send({message:'User Already exists.No need to save it again to the database'});
        }
        const result=await usersCollection.insertOne(userInfo);
        res.send(result);
    });

app.patch('/users/:email',async(req,res)=>{
    const email=req.params.email;
    const query={email:email};
    const updatedUserInfo=req.body;
    const {displayName,photoURL,phoneNumber}=updatedUserInfo;
    const updatedDoc={
        $set:{
            displayName,
            photoURL,
            phoneNumber
        }
    }
    const result=await usersCollection.updateOne(query,updatedDoc);
    res.send(result);
});

    // tutions api
    app.get('/tutions',async(req,res)=>{
        const query={};
        const {email}=req.query;
        if(email)
        {
            query.studentEmail=email;
        }
        const options={sort:{createdAt:-1}}
        const result=await tutionsCollection.find(query,options).toArray();
        res.send(result);
    });
    app.get('/tutions/:id',async(req,res)=>{
        const id=req.params.id;
        const query={_id:new ObjectId(id)};
        const result=await tutionsCollection.findOne(query);
        res.send(result);
    });
    app.patch('/tutions/:id',async(req,res)=>{
        const id=req.params.id;
        const updatedTutioninfo=req.body;
        const query={_id:new ObjectId(id)};
        const {updatedSubject,updatedStudentClass,updatedLocation,updatedBudget,updatedSchool,updatedDays,updatedTeachingTime,updatedStudentGender,updatedCurriculum,updatedDetails}=updatedTutioninfo;
        const updatedDoc={
            $set:{
                subject:updatedSubject,
                studentClass:updatedStudentClass,
                location:updatedLocation,
                budget:updatedBudget,
                school:updatedSchool,
                days:updatedDays,
                teachingTime:updatedTeachingTime,
                studentGender:updatedStudentGender,
                curriculum:updatedCurriculum,
                details:updatedDetails,
            }
        }
        const result=await tutionsCollection.updateOne(query,updatedDoc);
        res.send(result);
    });

    app.post('/tutions',async(req,res)=>{
        const tutionInfo=req.body;
        tutionInfo.createdAt=new Date().toLocaleString();
        tutionInfo.status='pending';
        const result=await tutionsCollection.insertOne(tutionInfo);
        res.send(result);
    });

    app.delete('/tutions/:id',async(req,res)=>{
        const id=req.params.id;
        const query={_id:new ObjectId(id)};
        const result = await tutionsCollection.deleteOne(query);
        res.send(result);
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port,()=>{
    console.log(`The Server is running at port : ${port}`);
})