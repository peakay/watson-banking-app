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
var useriddb = require('cloudant-quickstart')(cloudant_credentials.url, 'userids');
var balancedb = require('cloudant-quickstart')(cloudant_credentials.url, 'balances');

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
exports.response = function(req, res)
{
  // set the payload base options
  var payload = { workspace_id: config.conversations.workspace, context: {}, input: {text: ""} };

  useriddb.query({session: req.session.id}).then(
    function(result){
      payload.context.username = result[0]._id    
      console.log(payload.context.username)

    } 
  ).then(
    function(test){
      if (req.body) {
        if (req.body.input) { payload.input.text = req.body.input; }
        if (req.body.context) { 
          payload.context = req.body.context; 
        }
    
      } else {
        return res.send({"error": "Nothing received to process"})}
    
        // connect to the conversation workspace identified as config.conversations.workspace and ask for a response
        conversation.message(payload, function(err, data)
        {
          // return error information if the request had a problem
          if (err) {return res.status(err.code || 500).json(err); }
          // or send back the results if the request succeeded
          console.log(data)
          if(data.context['pendingDepositAmt'] != false || data.context['pendingDepositAmt'] != 0){
            balancedb.query({username: payload.context.username}).then(
              function(result){
                result = result[0]
                console.log(result)

                if(parseInt(result.balance) + parseInt(data.context['pendingDepositAmt']) < 0){
                  console.log("You can't withdraw more than you have!")
                  data.output['text'] = ["Your withdraw of " + data.context['pendingDepositAmt'] + "$ is greater than your posted balance of " + parseInt(result.balance) + "$"]
                }else{
                  balancedb.update(result._id, {balance: parseInt(result.balance) + parseInt(data.context['pendingDepositAmt']) }, true).then(console.log)
                }

                


                data.context.pendingDepositAmt = 0
              
              }

            ).then(
              function(final){
                return res.json(data);
              }
              
            )
            
            
          }else{
            return res.json(data);
          }
          
        });
    }

  ).catch(
    function(err){
      return "user not found!"
    }
  )

}

