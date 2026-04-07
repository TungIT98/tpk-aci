const fs = require('fs');
const content = fs.readFileSync('tmp_issues.json', 'utf8');
const data = JSON.parse(content);
const myId = '24ac8a23-d723-4909-bf40-05f4d4fce689';
const myIssues = data.filter(i => i.assigneeAgentId === myId);
myIssues.forEach(i => console.log('[' + i.status + '] ' + i.identifier + ' | ' + i.title.substring(0, 80)));
console.log('Total my issues:', myIssues.length);
