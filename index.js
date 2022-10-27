const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
var admin = require("firebase-admin");
var serviceAccount = require("./key.json");


//Creating express app
const app = express();
const apiPort = 3003 ;

const router = express.Router();

function clean(obj){
    console.log("received in function - ", obj);
    const value = obj.valueType;
    let content;
    console.log("value type - ", value);
    switch(value){
        case "integerValue":
            content = parseInt(obj.integerValue);
            break;
        case "stringValue":
            content = obj.stringValue;
            break;
        case "doubleValue":
            content = parseDouble(obj.doubleValue);
            break;
        case "arrayValue":
            content = obj.arrayValue.values;
            break;
        case "mapValue":
            content = obj.mapValue.fields;
            break;
        default:
            console.log("error");
            break;
    }
    console.log("absorbed thing - ", content)
    return content;
}

function cleancollection(obj){
    const arr = clean(obj);
    console.log("working with - ",arr);
    let content = [];
    arr.forEach(function(item){
        console.log("working with item - ",clean(item));
        let container = clean(item);
        let Namount = clean(container.amount);
        let Nname = clean(container.collection_name);
        let Nprice = clean(container.collection_price);
        content = [...content, {"collection_name":Nname, "amount":Namount, "collection_price":Nprice}];
    })
    console.log("clean collection - ", content)
    return content;
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();


router.post('/account', async function(request, response){
    console.log('------------------------------CREATING NEW ACCOUNT-------------------------------------------');
    try{
        const data = request.body;
        const extract = data.money;
        const build = {
            "money":extract,
            "collectables":[]
        }
        console.log(build);
        const database = db.collection('collectingapp');
        const {_path: {segments}} = await database.add(build);
        const id = segments[1];
        response.send({
           "id":id,
           "initial_balance":extract,
    })
    }catch(error){
        response.send({
            "ERROR":"unexpected error",
        })
        console.log(error);
        console.log("f");
    }
});

router.put('/account/:id', async function(request, response){
    console.log('-----------------------------UPDATING USER MONEY-------------------------------------');
    try{
        const {params: {id}} = request;                         // Read request data
        let add = parseInt(request.body.add);
        if(add<0){
            add = 0;    // Make money input always valid
        }
        //console.log(request);
        if(add>0){
            const getdatabase = db.collection('collectingapp');     // Get user we're adding to
            const {_fieldsProto : {money, collectables}} = await getdatabase.doc(id).get();

            const extract = parseInt(clean(money)) + (add);         // New money value

            const upddatabase = db.collection('collectingapp').doc(id);
            const resp = await upddatabase.update({                 // Update user's money in database
                "money":extract,
            })
            response.send({
                "current_balance":{
                    "money":extract,
                    "collectables":cleancollection(collectables)
                },
                "business_errors":[]
            })
        }else{
            response.send({
                "business_errors":"ERROR: money value should be more than 0",
            })
        }
    }catch(error){
        response.send({
            "errors":"ERROR: unexpected error",
        })
        console.log(error);
        console.log("f");
    }
});

router.post('/account/:id/order', async function(request, response){
    console.log('------------------------------ACCOUNT OPERATION-------------------------------------------');
    try{
        const {params: {id}} = request;    
        const data = request.body;
        const {operation, collection_name, amount, collection_price} = data;
        console.log("operation - ", operation)
        console.log("amount - ", amount)
        if(operation=="BUY"){
            console.log('------------------------------PURCHASING STUFF-------------------------------------------');
                const build = {
                    collection_name,
                    amount,
                    collection_price
                }
                console.log(build);

                const getdatabase = db.collection('collectingapp');     // Get user we're adding to
                const {_fieldsProto : {money, collectables}} = await getdatabase.doc(id).get();
                console.log((clean(money)), " > ", collection_price, "?");
                if(parseInt(clean(money))>=parseInt(collection_price)){
                    const newmoney = parseInt(clean(money)) - parseInt(collection_price);         // New money value
                    let newcoll = [...(cleancollection(collectables)), build];

                    console.log("new money - ",newmoney)
                    console.log("new collection - ",newcoll)
                    
                    const upddatabase = db.collection('collectingapp').doc(id);
                    const resp = await upddatabase.update({                 // Update user's money in database
                        "money":newmoney,
                        "collectables":newcoll,
                    })
                    response.send({
                        "current_balance":{
                            "money":newmoney,
                            "collectables":newcoll
                        },
                        "business_errors":[]
                    })
                }else{
                    response.send({
                        "current_balance":{
                            "money":clean(money),
                            "collectables":cleancollection(collectables)
                        },
                        "business_errors":["INSUFFICIENT BALANCE"]
                    })
                }
    }else if(operation=="SELL"){
        console.log('------------------------------SELLING STUFF-------------------------------------------');
        const getdatabase = db.collection('collectingapp');     // Get user we're adding to
        const {_fieldsProto : {money, collectables}} = await getdatabase.doc(id).get();
        const nicecol = cleancollection(collectables);
        console.log("FIND ITEM")
        let selitem = nicecol.find(function(item){
            console.log(item.collection_name," =? ", collection_name);
            return item.collection_name == collection_name;
        })
        console.log("xd ",selitem)
        if(selitem!=undefined){
            const newmoney = parseInt(clean(money)) + parseInt(selitem.collection_price);         // New money value
            let iIndex = nicecol.indexOf(selitem);
            nicecol.splice(iIndex, 1);

            console.log("new money - ",newmoney)
            console.log("new collection - ",nicecol)
            
            const upddatabase = db.collection('collectingapp').doc(id);
            const resp = await upddatabase.update({                 // Update user's money in database
                "money":newmoney,
                "collectables":nicecol,
            })
            response.send({
                "current_balance":{
                    "money":newmoney,
                    "collectables":nicecol
                },
                "business_errors":[]
            })
        }else{
            response.send({
                "current_balance":{
                    "money":clean(money),
                    "collectables":cleancollection(collectables)
                },
                "business_errors":["TRIED TO SELL ITEM THAT DOESN'T EXIST"],
            })
        }    
    }else{
            response.send({
                "errors":"ERROR: unsupported operation",
            })
        }
    }catch(error){
        response.send({
            "errors":"ERROR: unexpected error",
        })
        console.log(error);
        console.log("f");
    }
});

//Setting up express app
app.use(bodyParser.urlencoded({extended:true}))
app.use(cors());
app.use(bodyParser.json())
app.use('/', router)

// Tell app to listen for new calls and sleep when none are arriving
app.listen(apiPort, () => console.log(`server running on port ${apiPort}`))