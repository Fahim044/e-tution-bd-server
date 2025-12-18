const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app=express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET);
app.use(express.json());
app.use(cors());
const port=process.env.PORT || 4000;


const admin = require("firebase-admin");

// const serviceAccount = require("./e-tution-bd-4005d-firebase-adminsdk-fbsvc-c2d585f529.json");
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


const verifyFBToken=async(req,res,next)=>{
    const token=req.headers.authorization;
    if(!token)
    {
        return res.status(401).send({message:'Unauthorized Token'});
    }
    try{
        const idToken=token.split(' ')[1];
        const decoded=await admin.auth().verifyIdToken(idToken);
        // console.log(decoded);
        req.decoded_email=decoded.email;
    next();

    }
    catch(error)
    {
        return res.status(401).send({message:'Unauthorized Access'});
    }
    // console.log(token);
}

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
    const paymentsCollection=db.collection('payments');

    const verifyAdmin=async(req,res,next)=>{
        const email=req.decoded_email;
        const query={email};
        const user=await usersCollection.findOne(query);
        if(!user || user.role!=='admin')
        {
            return res.status(403).send({message:'Forbidden Access'});
        }
        next();
    }

    const verifyTutor=async(req,res,next)=>{
        const email=req.decoded_email;
        const query={email};
        const user=await usersCollection.findOne(query);
        if(!user || user.role!=='tutor')
        {
            return res.status(403).send({message:'Forbidden Access'});
        }
        next();
    }
    const verifyStudent=async(req,res,next)=>{
        const email=req.decoded_email;
        const query={email};
        const user=await usersCollection.findOne(query);
        if(!user || user.role!=='student')
        {
            return res.status(403).send({message:'Forbidden Access'});
        }
        next();
    }

    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // users api
    app.get('/public/users',async(req,res)=>{
        const query={};
        const {role}=req.query;
        if(role)
        {
            query.role=role;
        }
        const options={sort:{createdAt:-1}};
        const result=await usersCollection.find(query,options).toArray();
        res.send(result);
    });

    app.get('/users',verifyFBToken,verifyAdmin,async(req,res)=>{
        const query={};
        const {email,role}=req.query;
        if(email)
        {
            query.email=email;
            if(email !== req.decoded_email)
            {
                return res.status(403).send({message:'Forbidden Access'});
            }
        }
        if(role)
        {
            query.role=role;
        }
        const options={sort:{createdAt:-1}};
        const result=await usersCollection.find(query,options).toArray();
        res.send(result);
    });

    // it is for updating user's own profile,so ,no verification of role is applied here
    app.get('/users/:id',verifyFBToken,async(req,res)=>{
        const id=req.params.id;
        const query={_id:new ObjectId(id)};
        const result=await usersCollection.findOne(query);
        res.send(result);
    });

    // it is applied in useRole,so,as it is for extracting user's role,so,here,verification of role is not applied
    app.get('/users/:email/role',verifyFBToken,async(req,res)=>{
        const email=req.params.email;
        const query={email};
        if(email!==req.decoded_email)
        {
            return res.status(403).send({message:'Forbidden Access'});
        }
        const user=await usersCollection.findOne(query);
        res.send({role:user?.role || 'student'});
    })

    // here,all the users who will register in this application,this api is for it.so,verification of role is not applied
    app.post('/users',verifyFBToken,async(req,res)=>{
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

app.patch('/users/:email',verifyFBToken,verifyAdmin,async(req,res)=>{
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

app.patch('/users/:id/role',verifyFBToken,verifyAdmin,async(req,res)=>{
    const id=req.params.id;
    const {role}=req.body;
    const query={_id:new ObjectId(id)};
    const updatedDoc={
        $set:{role}
    };
    const result=await usersCollection.updateOne(query,updatedDoc);
    res.send(result);
});

app.delete('/users/:id',verifyFBToken,verifyAdmin,async(req,res)=>{
    const id=req.params.id;
    const query={_id:new ObjectId(id)};
    const result=await usersCollection.deleteOne(query);
    res.send(result);
});

    // tutions api
    // public for all
    app.get('/public/tutions',async(req,res)=>{
        const {subject,studentClass,location,limit=0,skip=0,searchText,sort='createdAt',order='desc',status}=req.query;
        const sortOption={};
        sortOption[sort || 'createdAt']=order==='asc'?1 : -1;
        const query={};
        if(status)
        {
            query.status=status;
        }
        if(searchText)
        {
            // query.subject=searchText;
            query.$or=[
                {subject:{$regex:searchText,$options:'i'}},
                {location:{$regex:searchText,$options:'i'}}
            ]
        }
        if(subject)
        {
            query.subject=subject;
        }
        if(studentClass)
        {
            query.studentClass=studentClass;
        }
        if(location)
        {
            query.location={$regex:location,$options:'i'};
        }
        console.log(req.query);
        const count=await tutionsCollection.countDocuments(query);
        const options={sort:{createdAt:-1}};
        const tutions=await tutionsCollection.find(query,options).sort(sortOption).limit(Number(limit)).skip(Number(skip)).toArray();
        res.send({tutions,total:count});
    });

    // from server side,it is taking the decision,who will see what
    app.get('/tutions',verifyFBToken,async(req,res)=>{
        // const {status,}=req.query;
        const email=req.decoded_email;
// limit=0,skip=0,sort='createdAt',order='desc',searchText,email
// console.log(req.query);
// const sortOption={};
// sortOption[sort || 'createdAt']=order==='asc'? 1: -1;
// console.log(sortOption);

const user=await usersCollection.findOne({email});
if(!user)
{
    return res.status(403).send({message:'Forbidden Access'});
}

        const query={};
        
        if(user.role==='student')
        {
            query.studentEmail=email;
        }
        // if(status)
        // {
        //     query.status=status;
        // }
        // if(searchText)
        // {
        //     // query.subject=searchText;
        //     query.$or=[
        //         {subject:{$regex:searchText,$options:'i'}},
        //         {location:{$regex:searchText,$options:'i'}}
        //     ]
        // }
        // const count=await tutionsCollection.countDocuments(query);

        // .sort(sortOption).limit(Number(limit)).skip(Number(skip))
        const options={sort:{createdAt:-1}};
    const tutions=await tutionsCollection.find(query,options).toArray();
        res.send(tutions);
        // {tutions,total:count}
    });

    //since this is for tution details,so anyone can see.so,no verification of role is applied here 
    app.get('/tutions/:id',verifyFBToken,async(req,res)=>{
        const id=req.params.id;
        const query={_id:new ObjectId(id)};
        const result=await tutionsCollection.findOne(query);
        res.send(result);
    });

    app.patch('/tutions/:id',verifyFBToken,verifyStudent,async(req,res)=>{
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

    app.patch('/tutions/:id/status',verifyFBToken,verifyAdmin,async(req,res)=>{
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

    app.post('/tutions',verifyFBToken,verifyStudent,async(req,res)=>{
        const tutionInfo=req.body;
        tutionInfo.createdAt=new Date().toLocaleString();
        tutionInfo.status='pending';
        const result=await tutionsCollection.insertOne(tutionInfo);
        res.send(result);
    });

    // from server side,it is taking the decision,who will see what
    app.get('/tutor-requests',verifyFBToken,async(req,res)=>{
        const email=req.decoded_email;
        const user=await usersCollection.findOne({email});
        if(!user)
        {
            return res.status(403).send({message:'Forbidden Access'});
        }
        const query={};
        if(user.role==='tutor')
        {
            query.tutorEmail=email;
        }
        const {tutionId,status}=req.query;
        // ,tutorEmail,studentEmail
        if(tutionId)
        {
            query.tutionId=tutionId;
        }
        // if(tutorEmail)
        // {
        //     query.tutorEmail=tutorEmail;
        // }
        if(user.role==='student')
        {
            query.studentEmail=email;
        }
        // if(studentEmail)
        // {
        //     query.studentEmail=studentEmail;
        //     if(studentEmail!==req.decoded_email)
        //     {
        //         return res.status(403).send({message:'Forbidden Access'});
        //     }
        // }
        if(status)
        {
            query.status=status;
        }
       
        const result=await tutorReqCollection.find(query).sort({appliedAt:-1}).toArray();
        res.send(result);

    });

    app.post('/tutor-requests',verifyFBToken,verifyTutor,async(req,res)=>{
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

    app.patch('/tutor-requests/:id',verifyFBToken,verifyTutor,async(req,res)=>{
        const updatedInfo=req.body;
        const id=req.params.id;
      
        const query={_id:new ObjectId(id)};
        const updatedDoc={
            $set:{...updatedInfo}
        };
        const result=await tutorReqCollection.updateOne(query,updatedDoc);
        res.send(result);
    });

    // this should be used only for reject a tutor request,because,to approve,it is handled by stripe.
    app.patch('/tutor-requests/:id/status',verifyFBToken,verifyStudent,async(req,res)=>{
        const {status}=req.body;
        const id=req.params.id;
        const query={_id:new ObjectId(id)};
        const updatedDoc={
            $set:{status}
        };
        const result=await tutorReqCollection.updateOne(query,updatedDoc);
        res.send(result);
    });

    app.delete('/tutor-requests/:id',verifyFBToken,verifyTutor,async(req,res)=>{
        const id=req.params.id;
        const query={_id:new ObjectId(id)};
        const result=await tutorReqCollection.deleteOne(query);
        res.send(result);
    });

    app.delete('/tutions/:id',verifyFBToken,verifyStudent,async(req,res)=>{
        const id=req.params.id;
        const query={_id:new ObjectId(id)};
        const result = await tutionsCollection.deleteOne(query);
        res.send(result);
    });

    // stripe payment:
    app.post('/payment-checkout-session',verifyFBToken,verifyStudent,async(req,res)=>{
        const paymentInfo=req.body;
        const amount=parseInt(paymentInfo.cost)*100;
        const session=await stripe.checkout.sessions.create({
            line_items:[
                {
                    price_data:{
                        currency:'BDT',
                        unit_amount:amount,
                        product_data:{
                            name:paymentInfo.tutorName
                        }
                    },
                    quantity:1
                }
            ],
            customer_email:paymentInfo.studentEmail,
            mode:'payment',
            metadata:{
                tutorReqId:paymentInfo.tutorReqId,
                tutionId:paymentInfo.tutionId,
                tutorName:paymentInfo.tutorName,
                tutorEmail:paymentInfo.tutorEmail
            },
            success_url:`${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url:`${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`
        })
        res.send({url:session.url});
    });

    app.patch('/payment-success',verifyFBToken,verifyStudent,async(req,res)=>{
        const sessionId=req.query.session_id;
        const session=await stripe.checkout.sessions.retrieve(sessionId);
        const transactionId= session.payment_intent;
        const query={transactionId};
        const paymentExists=await paymentsCollection.findOne(query);
        if(paymentExists)
        {
            return res.send({
                message:'Already Exists',
                transactionId
            });
        }
        if(session.payment_status==='paid')
        {
            const id=session.metadata.tutorReqId;
            const query={_id:new ObjectId(id)};
            const update={
                $set:{
                    paymentStatus:'paid',
                    status:'approved'
                }
            };
            const result=await tutorReqCollection.updateOne(query,update);
            
            const payment={
                amount:session.amount_total/100,
                currency:session.currency,
                studentEmail:session.customer_email,
                tutorReqId:session.metadata.tutorReqId,
                tutionId:session.metadata.tutionId,
                tutorName:session.metadata.tutorName,
                tutorEmail:session.metadata.tutorEmail,
                transactionId:session.payment_intent,
                paymentStatus:session.payment_status,
                paidAt:new Date().toLocaleString(),

            };
            const resultPayment=await paymentsCollection.insertOne(payment);
            return res.send({
                success:true,
                transactionId:session.payment_intent,
                modifyTution:result,
                paymentInfo:resultPayment
            });

        }
        return res.send({success:false});
    });

    app.get('/payments',verifyFBToken,async(req,res)=>{
        const email=req.decoded_email;
        const user=await usersCollection.findOne({email});
        if(!user)
        {
            return res.status(403).send({message:'Forbidden Access'});
        }
        const query={};
        if(user.role==='student')
        {
            query.studentEmail=email;
        }
        if(user.role==='tutor')
        {
            query.tutorEmail=email;
        }
        const options={sort:{paidAt:-1}};
        const result=await paymentsCollection.find(query,options).toArray();
        res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port,()=>{
    console.log(`The Server is running at port : ${port}`);
})