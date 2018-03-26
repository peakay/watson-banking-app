/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var Watson = require( 'watson-developer-cloud/conversation/v1' );
var config = require("../../env.json");
var myUsers = require('./cloudant_utils');
var cloudant_credentials = require('../../env.json').cloudant;
//useriddb contains some session info, routing number
var useriddb = require('cloudant-quickstart')(cloudant_credentials.url, 'userids');
var balancedb = require('cloudant-quickstart')(cloudant_credentials.url, 'balances');
var contextdb = require('cloudant-quickstart')(cloudant_credentials.url, 'context');

var conversation = new Watson({
  username: config.conversations.username,
  password: config.conversations.password,
  url: config.conversations.url,
  version_date: '2018-03-24',
  version: 'v1'
});

/**
 * response connects to the previously defined conversation server and sends in the input and context information from the browser
 * @param {object} req - nodejs object with the request information 
 * req.body holds post parameters
 * req.body.input - text from browser
 * req.body.context - context from browser
 * @param {object} res - nodejs response object
 * @param {object} next - nodejs next object - used if this routine does not provide a response
 */
exports.response = async function(req, res)
{
  // set the payload base options
  var payload = { workspace_id: config.conversations.workspace, context: {}, input: {text: ""} };

  // if req.body exists, then check for text and context information. use them if they are present
  if (req.body) {
    if (req.body.input) { payload.input.text = req.body.input; }

  } else {
    return res.send({"error": "Nothing received to process"})}

  var username = await getUsername(req.session.id)


  payload.context = await getContext(username)
  payload.context.username = username
  console.log(payload.context)
  

    // connect to the conversation workspace identified as config.conversations.workspace and ask for a response
  conversation.message(payload, async function(err, data)
    {
      // return error information if the request had a problem
      if (err) {return res.status(err.code || 500).json(err); }
      // or send back the results if the request succeeded


      console.log(data.context)

      if(data.context.pendingBalance == "1"){
        var userBalance = await getBalance(payload.context.username)
        console.log("adding " + userBalance + " and " + data.context.pendingDepositAmt)
        if(userBalance + parseInt(data.context.pendingDepositAmt) > 0){
          var updatedBalance = await updateBalance(payload.context.username, userBalance, parseInt(data.context.pendingDepositAmt))

        }else{
          data.output['text'] = ["Your withdraw of " + data.context['pendingDepositAmt'] + "$ is greater than your posted balance of " + parseInt(userBalance) + "$", "Please try with a lesser amount of money!"]
        }

      }

      if(data.context.getBalance == "1"){
        var userBalance = await getBalance(payload.context.username)
        console.log(data.output['text'])
        data.output['text'] += ['Your current posted balance is: ' + userBalance + '$']

      }
      if(data.context.getRouting == "1"){
        var routingNumber = await getRoutingNumber(payload.context.username)
        data.output['text'] = ['Your routing number is: ' + routingNumber]

      }
      //regardless of failure, reset the pending stats
      data.context.pendingBalance = 0
      data.context.pendingDepositAmt = 0
      data.context.getBalance = 0
      data.context.getRouting = 0











      await updateContext(username, data.context)

      return res.json(data);
    });
}





var updateBalance = async function(username, oldBalance, newBalance){
  var update = await balancedb.update(username, {balance: parseInt(oldBalance) + parseInt(newBalance) }, true)

  return "done!"
  
}
var getId = function(username){
  balancedb.query({username: payload.context.username}).then(
    function(result){
      return result[0]._id
    }
  )
}

var getUsername = async function(sessionid){
  var username = await useriddb.query({session: sessionid})
  console.log(username)
  return username[0]._id

}
var getRoutingNumber = async function(username){
  var routing = await useriddb.get(username)
  return routing.routingnum


}
var getBalance = async function(username){
  console.log("Getting balance " + username)
  var balance = await balancedb.get(username)
  return balance.balance
}

var transferBalance = function(user1, user2, amount){
//transfers amount from user1 to user2

}

var updateContext = async function(username, contextNew){

  await contextdb.update(username, contextNew).catch("update context error")

  return "done!"

}

var insertContext = async function(user, contextNew){
  await contextdb.insert({username: user, conversation_id: context.conversation_id, context: contextNew})
  return "done!"

}

var getContext = async function(id){
  console.log(id)
  var context = await contextdb.get(id).catch(function(err){console.log("get context error " + err)})
  return context

}