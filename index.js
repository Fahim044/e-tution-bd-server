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
    const tutorReqCollection=db.collection('tutorRequests');

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

    app.get('/users/:email/role',async(req,res)=>{
        const email=req.params.email;
        const query={email};
        const user=await usersCollection.findOne(query);
        res.send({role:user?.role || 'student'});
    })

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

app.patch('/users/:id/role',async(req,res)=>{
    const id=req.params.id;
    const {role}=req.body;
    const query={_id:new ObjectId(id)};
    const updatedDoc={
        $set:{role}
    };
    const result=await usersCollection.updateOne(query,updatedDoc);
    res.send(result);
});

app.delete('/users/:id',async(req,res)=>{
    const id=req.params.id;
    const query={_id:new ObjectId(id)};
    const result=await usersCollection.deleteOne(query);
    res.send(result);
});

    // tutions api
    app.get('/tutions',async(req,res)=>{
        const {email,limit,status}=req.query;
// console.log(req.query);
        const query={};
        
        if(email)
        {
            query.studentEmail=email;
        }
        if(status)
        {
            query.status=status;
        }
        const options={sort:{createdAt:-1}}
        const result=await tutionsCollection.find(query,options).limit(Number(limit)).toArray();
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
        const {subject,studentClass,location,budget,school,days,teachingTime,studentGender,curriculum,details}=updatedTutioninfo;
        const updatedDoc={
            $set:{
                subject,
                studentClass,
                location,
                budget,
                school,
                days,
                teachingTime,
                studentGender,
                curriculum,
                details
            }
        }
        const result=await tutionsCollection.updateOne(query,updatedDoc);
        res.send(result);
    });

    app.patch('/tutions/:id/status',async(req,res)=>{
        const {status}=req.body;
        const id=req.params.id;
        const query={_id:new ObjectId(id)};
        const updatedDoc={
            $set:{
                status
            }
        };
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

    app.get('/tutor-requests',async(req,res)=>{
        const {tutionId,tutorEmail,studentEmail,status}=req.query;
        const query={};
        if(tutionId)
        {
            query.tutionId=tutionId;
        }
        if(tutorEmail)
        {
            query.tutorEmail=tutorEmail;
        }
        if(studentEmail)
        {
            query.studentEmail=studentEmail;
        }
        if(status)
        {
            query.status=status;
        }
       
        const result=await tutorReqCollection.find(query).toArray();
        res.send(result);

    });

    app.post('/tutor-requests',async(req,res)=>{
    const tutorRequest=req.body;
    const {tutionId,tutorEmail}=tutorRequest;
    const tution=await tutionsCollection.findOne({_id:new ObjectId(tutionId)});
    if(!tution)
    {
        return res.status(404).send({message:'Tution not found'});
    }
    tutorRequest.studentEmail=tution.studentEmail;
    tutorRequest.appliedAt=new Date().toLocaleString();
    tutorRequest.status='pending';

    // validate if that tutor's application already exists or not
    const tutorReqExists=await tutorReqCollection.findOne({tutionId,tutorEmail});
    
    if(tutorReqExists)
    {
        return res.status(409).send({message:'Tutor Already Applied'});
    }


    const result = await tutorReqCollection.insertOne(tutorRequest);
        res.send(result);
    });

    app.patch('/tutor-requests/:id',async(req,res)=>{
        const updatedInfo=req.body;
        const id=req.params.id;
      
        const query={_id:new ObjectId(id)};
        const updatedDoc={
            $set:{...updatedInfo}
        };
        const result=await tutorReqCollection.updateOne(query,updatedDoc);
        res.send(result);
    });

    app.patch('/tutor-requests/:id/status',async(req,res)=>{
        const {status}=req.body;
        const id=req.params.id;
        const query={_id:new ObjectId(id)};
        const updatedDoc={
            $set:{status}
        };
        const result=await tutorReqCollection.updateOne(query,updatedDoc);
        res.send(result);
    });

    app.delete('/tutor-requests/:id',async(req,res)=>{
        const id=req.params.id;
        const query={_id:new ObjectId(id)};
        const result=await tutorReqCollection.deleteOne(query);
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