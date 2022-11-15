require('dotenv').config();

// eslint-disable-next-line security/detect-child-process
const execSync = require('child_process').execSync;

const snykAuthCommand = `npx snyk auth ${process.env.SNYK_AUTH_TOKEN}`;
console.log('--------- [Snyk Authentication] ---------');
console.log(`npx snyk auth <secret>`);
execSync(snykAuthCommand, {stdio: 'inherit'});

const snykTestCommand = `npx snyk test`;
console.log('--------- [Snyk Package Analyzer] ---------');
console.log(snykTestCommand);
execSync(snykTestCommand, {stdio: 'inherit'});
