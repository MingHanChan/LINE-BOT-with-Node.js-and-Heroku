'use strict';
const line = require('@line/bot-sdk');
const express = require('express');
const request = require('request');
//設定LINE BOT的access token跟secret
const config = {
  channelAccessToken: 'IRWhBYS4VFUM71vhvcXWeDpn5OSJRYFcl+WzneABkSmSeP1mjMILX23n6VsqwMaZF+ZcxSiR+48SQ2emx4tnQhfFOV0nYrjMn9hYRJCYWHGsyk5XjtYUKbYCJsxg9WHuxLZHl97Ax792Dq5YH8XY1AdB04t89/1O/w1cDnyilFU=',
  channelSecret: 'ed38bafeafa964aeeffbb6ccbcf53f08',
};
//設定google api key
const googleMapAPI = {
  key: 'AIzaSyDgC1Xk110qPtp1M_ZL0eJ-V4tbqf4X4Io'
};

const client = new line.Client(config);
const app = express();
app.post('/callback', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(`Event ${err}`);
      res.status(500).end();
    });
});
app.get('/', (req, res) => {
  res.json("ok");
});

let userLocation = {};

function handleEvent(event) {
  if (event.replyToken === "00000000000000000000000000000000" ||
    event.replyToken === "ffffffffffffffffffffffffffffffff") {
    return Promise.resolve(null);
  }
  if (event.type === 'message' && event.message.type === 'location') {
    userLocation[event.source.userId] = event.message;
    const replyMsg = {
      type: 'text',
      text: '輸入要查詢的地點類型與半徑範圍(公尺)\n例如:\n300公尺內的餐廳\r\n1000 加油站\r\n提款機3000\r\n'
    };
    return client.replyMessage(event.replyToken, replyMsg);
  }
  else if (event.type === 'message' &&
    event.message.type === 'text' &&
    userLocation[event.source.userId] !== undefined) {
    const lat = userLocation[event.source.userId].latitude;
    const lng = userLocation[event.source.userId].longitude;
    let radius = event.message.text.match(/\d/g);
    if (radius === null) {
      radius = 1500
    }
    else {
      radius = radius.join('');
      radius = radius < 5 ? 100 : radius;
    }
    //用正規表達式找出搜尋種類. ex.餐廳, 機場
    let searchType;
    let searchTypeEng;
    if(event.message.text.match(/[\u9910\u5ef3]+/g) !== null){
      searchTypeEng = 'restaurant';
      searchType = '餐廳';
    }
    else if(event.message.text.match(/[\u5716\u66f8\u9928]+/g) !== null){
      searchTypeEng == 'library';
      searchType = '圖書館';
    }
    else if(event.message.text.match(/[\u5716\u66f8\u9928]+/g) !== null){
      searchTypeEng == 'atm';
      searchType = '提款機';
    }
    else if(event.message.text.match(/[\u9eb5\u5305]+/g) !== null ||
            event.message.text.match(/[\u86cb\u7cd5]+/g) !== null ||
            event.message.text.match(/[\u70d8\u7119]+/g) !== null ){
      searchTypeEng == 'bakery';
      searchType = '蛋糕店';
    }
    else if(event.message.text.match(/[\u52a0\u6cb9\u7ad9]+/g) !== null){
      searchTypeEng == 'gas_station';
      searchType = '加油站';     
    }
    else{
      searchTypeEng == null;
      searchType = '餐廳';
    }

    searchTypeEng = searchTypeEng === null ? 'restaruant' : searchTypeEng;
    const searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?
            location=${lat},${lng}&
            radius=${radius}&
            type=${searchTypeEng}&
            language=zh-TW&
            key=${googleMapAPI.key}`.replace(/\n/g, '').replace(/\s/g, '');
    request.get(searchUrl, (err, httpResponse, body) => {
      let msgReply = { type: 'text', text: 'Searching' };
      if (httpResponse.statusCode === 200) {
        const resBody = JSON.parse(body);
        let places = resBody.results.map((p) => {
          return `${p.name}\r\nhttps://www.google.com/maps/place/?q=place_id:${p.place_id}`
        });
        places.unshift(`${radius}公尺內的${searchType}：`);
        msgReply.text = places.join('\r\n');
      } else {
        msgReply.text = `${radius}公尺內沒有找到${searchType}`;
      }
      return client.replyMessage(event.replyToken, msgReply);
    })
    delete userLocation[event.source.userId];
  } else {
    const searchReply = { type: 'text', text: '請輸入位置資訊!' };
    return client.replyMessage(event.replyToken, searchReply);
  }
  return Promise.resolve(null);
}
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
