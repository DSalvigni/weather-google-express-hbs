const express = require('express');
const hbs = require('hbs');
const os = require('os');
const moment = require('moment');
const fs = require('fs');
const bodyParser = require('body-parser');
const axios = require('axios')

//Here we are configuring express to use body-parser as middle-ware.



//We start the middleware plus we use body parser to get the parameter
var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

//We create the port for Heroku and a TS
var ts = moment().format('YYYY-MM-DD_HH:mm:ss_Z');
var connected = 0;
const PORT = process.env.PORT||5000;


//Start the server and log info in console
app.listen(PORT,() => {
    var ifaces = os.networkInterfaces();
    Object.keys(ifaces).forEach(function (ifname) {
    var alias = 0;
    ifaces[ifname].forEach(function (iface) {
        if ('IPv4' !== iface.family || iface.internal !== false) {
        // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
        return;
        }

        if (alias >= 1) {
        // this single interface has multiple ipv4 addresses
        console.log('Server listening on: '+ifname + ':' + alias, iface.address+' - Port:'+PORT);
        } else {
        // this interface has only one ipv4 adress
        console.log('Server listening on: '+ifname, iface.address+' - Port:'+PORT);
        }
        ++alias;
    });
    });
});

//We include the partials for the HTML template
hbs.registerPartials(__dirname +'/views/partials');
app.set('view engine','hbs');
app.use(express.static(__dirname +'/public'));

//Date for the footer
hbs.registerHelper('getCurrentYear',()=>{
    return new  Date().getFullYear();
});

//Middleware to log the connection
app.use((res,req,next)=>{
    connected = connected + 1;
    fs.appendFile('server.log',connected+'_'+ts+'\n',(err) =>{
        if(err){
            console.log('Unable to append server.log');
        }
    });
    next();
});

app.get('/',(req,res)=>{
    res.render('home.hbs');
    console.log('Connected to HOME '+ts);
}); 

app.get('/about',(req,res)=>{
    res.render('about.hbs');
    console.log('Connected to ABOUT '+ts);
}); 

app.get('/error',(req,res)=>{
    res.render('error.hbs');
    console.log('Connected to ERROR '+ts);
}); 

//Wehn we get the submit button, the route look fort  "weather" and collect the query
app.get('/weather',(req,res)=>{
    let location =req.query.location;
    let weatherUrl = null;
    let lat =0;
    let lng =0;
    let correctedAddress = '';
    var encodedAddress = encodeURIComponent(location);
    let googleKey = 'GOOGLE-API-KEY';
    let skyKey = 'DARK-SKY-API-KEY';
    var geocodeUrl = 'https://maps.googleapis.com/maps/api/geocode/json?key='+googleKey+'&address='+encodedAddress;
    //If the query is empty we render the weather page empty
    if (location == ''){
        var data = location;
        return res.render('weather.hbs',{data}); 
    }
    axios.get(geocodeUrl)
    .then((response) =>{
        if(response.data.status === 'ZERO_RESULTS'){
            var data_null = 'ZERO_RESULT from Google API';
            res.render('error.hbs',{data_null});
            throw  new Error('The address has been not found from Google API'); 
        }
        
        //we collect lat/lnt from google
        if (response.data.results.length > 0) {
            lat = response.data.results[0].geometry.location.lat;
            lng = response.data.results[0].geometry.location.lng;
        }
        weatherUrl = 'https://api.darksky.net/forecast/'+skyKey+'/'+lat+','+lng;
        correctedAddress = response.data.results[0].formatted_address;
        console.log('Got the address from Google -> '+correctedAddress);
        console.log('Got the lat/lng from Google -> '+lat+' '+lng);
        return axios.get(weatherUrl);
    })
    .then((response)=>{
        var temperature = ((response.data.currently.temperature-32)*5)/9;
        var apparentTemperature = ((response.data.currently.apparentTemperature-32)*5)/9;
        var hourlySummary = response.data.hourly.summary;
        var summary = response.data.currently.summary;
        var summaryDaily =  response.data.daily.summary;
        var pressure =  response.data.currently.pressure;
        var humidity =  response.data.currently.humidity;
        var timezone =  response.data.currently.timezone;
        var time = new Date();
     
       var  finalJson = {
            'insertedLocation':location,
            'latitude':lat,
            'longitude':lng,
            'address': correctedAddress,
            'temperature':temperature,
            'apparentTemperature':apparentTemperature,
            'hourlyWeather': hourlySummary,
            'currentWeather':summary,
            'pressure': pressure,
            'humidity' : humidity, 
            'summaryDaily' : summaryDaily,
            'author' : 'Daniele Salvigni ~ SanGy ~',
            'currentTime':time
        };
        data = finalJson;
        console.log('Got from Geo API -> '+finalJson.summaryDaily);
        res.render('weather.hbs',{data});        
    })
    .catch((e)=>{
        if(e.code === 'ENOTFOUND'){
           console.log('Unable to connect to Google API Server.')
        } else{
           console.log(e.message);
        }
        
    });

});