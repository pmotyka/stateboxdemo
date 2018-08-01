'use strict';
const awsXRay = require('aws-xray-sdk-core');
const AWS = awsXRay.captureAWS(require('aws-sdk'));
const REGION = process.env.AWS_REGION || 'us-west-2';
AWS.config.update({region: REGION});

const Statebox = require('@wmfs/statebox');
const MemoryDao = require('@wmfs/statebox/lib/dao/Memory-dao');
const CallbackManager = require('@wmfs/statebox/lib/Callback-manager');
const ParallelBranchTracker = require('@wmfs/statebox/lib/Parallel-branch-tracker');
const executioner = require('@wmfs/statebox/lib/executioner');

const options = {
  dao: new MemoryDao(),
  callbackManager: new CallbackManager(),
  parallelBranchTracker: new ParallelBranchTracker(),
  executioner: executioner
};

const statebox = new Statebox(options);

statebox.createModuleResources(
  {
    hello1: class Hello1 {
      async run (event, context) {
	const list =  event.results;
        let lambda = new AWS.Lambda(),
        params = {
          FunctionName: 'stateboxdemo-dev-hello1'
        };
        let response = await lambda.invoke(params).promise();
	list.push(response);
        context.sendTaskSuccess({results: list});
      }
    },
    hello2: class Hello2 {
      async run (event, context) {
	const list = event.results;
        let lambda = new AWS.Lambda(),
        params = {
          FunctionName: 'stateboxdemo-dev-hello2'
        };
        let response = await lambda.invoke(params).promise();
	list.push(response);
        context.sendTaskSuccess({results: list});
      }
    }
  }
);

const info = statebox.createStateMachines(
  {
    'hello': {
      StartAt: 'Hellos',
      States: {
        Hellos: {
          Type: "Parallel",
          End: true,
          Branches: [
            {
              StartAt: 'Hello1',
              States: {
                Hello1: {
                  Type: 'Task',
                  Resource: 'module:hello1',
                  End: true
                }
              }
            },
            {
              StartAt: 'Hello2',
              States: {
                Hello2: {
                  Type: 'Task',
                  Resource: 'module:hello2',
                  End: true
                }
              }
            }
          ]
        }
      }
    }
  },
  {},
  function (err) {
  }
);

module.exports.hello1 = async (event, context, callback) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Hello from hello1',
      input: event
    }),
  };
  callback(null, response);
};

module.exports.hello2 = async (event, context, callback) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Hello from hello2',
      input: event
    }),
  };
  callback(null, response);
};

module.exports.stateboxdemo = async (event, context, callback) => {

  let executionName;
  let executionDescription1;
  let executionDescription2;

  executionDescription1 = await statebox.startExecution(
    {
      results: []
    },  // input
    'hello', // state machine name
    {} // options
  );
  executionDescription2 = await statebox.waitUntilStoppedRunning(executionDescription1.executionName);

  const response = {
    statusCode: 200,
    body: executionDescription2
  };

  callback(null, response);
};
