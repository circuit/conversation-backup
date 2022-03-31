const Circuit   = require('circuit-api-sdk');
const fs        = require('fs');
const util      = require('util');
const https     = require('https');
const config    = require('./config.txt');

const con = new Circuit({server:config.server,cookie:`connect.sess=${config.cookie}`});

// generic listener
con.on('log', (msg) => fs.appendFileSync('log.txt', `${msg}\n`));
con.on('error', console.error);

const getColor = function(count) {
    if (count % 2 === 0) {
        return 'E7EB90';
    } else {
        return 'FADF63';
    }
}

const ItemState = {
    CREATED: 'Created',
    EDITED: 'Edited',
    DELETED: 'Deleted',
    CLUSTERED: 'Clustered'
};

const ConvItemType = {
    CONVERSATION_CREATED: 'Conversation created',
    PARTICIPANT_ADDED: 'Participant added',
    PARTICIPANT_REMOVED: 'Participant removed',
    CONVERSATION_RENAMED: 'Conversation renamed',
    CONFERENCE_DETAILS_CHANGED: 'Conference details changed',
    CONVERSATION_MODERATED: 'Conversion moderated',
    MODERATOR_RIGHTS_GRANTED: 'Moderator rights granted',
    MODERATOR_RIGHTS_DROPPED: 'Moderator rights dropped',
    GUEST_ACCESS_ENABLED: 'Guest access enabled',
    GUEST_ACCESS_DISABLED: 'Guest access disabled',
    AVATAR_CHANGED: 'Avatar changed',
    RETENTION_POLICY_CHANGED: 'Retention policy changed',
    PARTICIPANT_HARD_REMOVED: 'Participant hard removed',
    RETENTION_ITEMS_REMOVED: 'Retention items removed'
};

const placeHolderSize = 10;
var myOwnUser = null;
const users = {};
const conversations = {};
const threads = {};
const attachments = {};
const thumbnailRegEx = new RegExp(/thumbnail___/);

con.login()
.then(user => {
    myOwnUser = user;
    if (fs.existsSync(`conversations_${myOwnUser.emailAddress}.csv`) == false) {
        console.log(`Welcome ${user.displayName}. Loading your conversations...`);
        getConversations(new Date().getTime(), 'BEFORE', '25', () => {
            getUsersByIds(Object.keys(users), () => {
                let output = ''
                const convIds = Object.keys(conversations);
                for (let i = 0; i < convIds.length; i++) {
                    const conv = conversations[convIds[i]];
                    output += conv.convId + ';' + conv.type + ';';
                    if (conv.type === 'DIRECT') {
                        let userId = '';
                        for (let j = 0; j < conv.participants.length; j++) {
                            const participant = conv.participants[j];
                            if (participant.userId !== myOwnUser.userId) {
                                userId = participant.userId;
                            }
                        }
                        if (userId.length == 0) {
                            if (conv.creatorId !== myOwnUser.userId) {
                                userId = conv.creatorId;
                            } else {
                                userId = '0';
                            }
                        }
                        output += users[userId].displayName;
                    } else {
                        if (conv.topic && conv.topic.length > 0) {
                            output += conv.topic;
                        } else {
                            output += conv.topicPlaceholder;
                        }
                    }
                    output += ';\r\n';
                }
                fs.writeFileSync(`conversations_${myOwnUser.emailAddress}.csv`, output);
                process.exit();
            })
        });
    } else {
        console.log(`Welcome ${user.displayName}. Loading your selected data...`);
        fs.existsSync('./output') === false && fs.mkdirSync('./output');
        const conversationsToLoad = fs.readFileSync(`conversations_${myOwnUser.emailAddress}.csv`).toString().split(/\r?\n/).filter(item => item !== '');
        // fs.appendFileSync('debug.txt', `conversationsToLoad[${conversationsToLoad.length}]\n`);
        const loadEverything = (index) => {
            // fs.appendFileSync('debug.txt', `loadEverything initiated with index[${index}]\n`);
            if (index < conversationsToLoad.length) {
                const conversationDetails = conversationsToLoad[index].split(';');
                getConversationFeed(conversationDetails[0], conversationDetails[2], new Date().getTime(), () => {
                    // fs.appendFileSync('debug.txt', `return from getConversationFeed index[${index}]\n`);
                    getConversationThread(conversationDetails[0], conversationDetails[2], () => {
                        // fs.appendFileSync('debug.txt', `return from getConversationThread index[${index}]\n`);
                        fs.existsSync(`./output/${conversationDetails[0]}`) === false && fs.mkdirSync(`./output/${conversationDetails[0]}`);
                        getConversationAttachments(conversationDetails[0], conversationDetails[2], () => {
                            // fs.appendFileSync('debug.txt', `return from getConversationAttachments index[${index}]\n`);
                            loadEverything(index + 1);
                        });
                    });
                });
            } else {
                getUsersByIds(Object.keys(users), () => {
                    console.log('Loaded all data... creating output files');
                    const allConvs = Object.keys(conversations);
                    for (const conv of allConvs) {
                        const allConvsSorted = conversations[conv].items.sort(compare);
                        let output = `<b>${conversations[conv].name}</b>`
                        for (let i = 0; i < allConvsSorted.length; i++) {
                            const convItem = allConvsSorted[i];
                            output += `<table style="width: 100%; border-bottom: 1px dotted black; background-color: #${getColor(i)}">`;
                            output += `<tr style="vertical-align: top;">`;
                            output += `<td style="width: 15%">`;
                            convItem.creatorId && users[convItem.creatorId] && (output += users[convItem.creatorId].displayName);
                            convItem.text && (output += `<br><text style="font-size: 10px;">${ItemState[convItem.text.state]}</text>`);
                            output += `</td><td style="width: 10%">`;
                            output += `<text style="font-size: 10px;">${getDateForOutput(new Date(convItem.creationTime))}</text>`;
                            output += `</td><td>`;
                            if (convItem.text) {
                                if (convItem.text.subject) {
                                    output += `<b>${convItem.text.subject}</b>`;
                                    convItem.text.content && (output += '<br>');
                                }
                                convItem.text.content && (output += `${convItem.text.content}`);
                                convItem.text.likedByUsers && (output += `&nbsp;<text style="font-size: 9px;">&#x1F44D;(${convItem.text.likedByUsers.length})</text>`);
                            }
                            convItem.system && (output += `${ConvItemType[convItem.system.type]}`);
                            if (convItem.attachments) {
                                for (let a = 0; a < convItem.attachments.length; a++) {
                                    if (thumbnailRegEx.test(convItem.attachments[a].fileName.toLowerCase()) === false) {
                                        const href = `./${conv}/${convItem.attachments[a].fileId}_${convItem.attachments[a].fileName}`;
                                        output += `<br><b><a download="${convItem.attachments[a].fileName}" href="${href}">${convItem.attachments[a].fileName}</a></b>`;
                                    }
                                }
                            }
                            output += `</td></tr>`;
                            if (convItem.itemId && threads[convItem.itemId]) {
                                for (let j = 0; j < threads[convItem.itemId].length; j++) {
                                    const threadItem = threads[convItem.itemId][j];
                                    output += `<tr style="vertical-align: top;"><td style="width: 15%">`;
                                    threadItem.creatorId && users[threadItem.creatorId] && (output += users[threadItem.creatorId].displayName);
                                    threadItem.text && (output += `<br><text style="font-size: 10px;">${ItemState[threadItem.text.state]}</text>`);
                                    output += `</td><td style="width: 10%">`;
                                    output += `<text style="font-size: 10px;">${getDateForOutput(new Date(threadItem.creationTime))}</text>`;
                                    output += `</td><td>`;
                                    threadItem.text && threadItem.text.content && (output += threadItem.text.content);
                                    threadItem.text && threadItem.text.likedByUsers && (output += `&nbsp;<text style="font-size: 9px;">&#x1F44D;(${threadItem.text.likedByUsers.length})</text>`);
                                    if (threadItem.attachments) {
                                        for (let a = 0; a < threadItem.attachments.length; a++) {
                                            if (thumbnailRegEx.test(threadItem.attachments[a].fileName.toLowerCase()) === false) {
                                                const href = `./${conv}/${threadItem.attachments[a].fileId}_${threadItem.attachments[a].fileName}`;
                                                output += `<br><b><a download="${threadItem.attachments[a].fileName}" href="${href}">${threadItem.attachments[a].fileName}</a></b>`;
                                            }
                                        }
                                    }
                                    output += `</td></tr>`;
                                }
                            }
                            output += `</table>`;
                        }
                        fs.writeFileSync(`./output/${conversations[conv].name.replace(/[^a-zA-Z0-9\s]/g, "")}.html`, output);
                    }
                    process.exit();
                });
            }
        }
        loadEverything(0);
    }
})
.catch(err => {
    console.error('reject: ' + util.inspect(err, { showHidden: true, depth: null}));
});

const compare = ( a, b ) => {
  if ( a.creationTime < b.creationTime ) {
    return -1;
  }
  if ( a.creationTime > b.creationTime ) {
    return 1;
  }
  return 0;
}

const printProgress = (message, last) => {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(message);
    if (last === true) {
        process.stdout.write('\n');
    }
}

const getDate = (date) => {
    let now = date || (new Date());
    let MM = (now.getMonth() + 1);
        if (MM < 10) { MM = '0' + MM; }
    let DD = now.getDate();
        if (DD < 10) { DD = '0' + DD; }
    let H = now.getHours();
        if (H < 10) { H = '0' + H; }
    let M = now.getMinutes();
        if (M < 10) { M = '0' + M; }
    return `${now.getFullYear()}-${MM}-${DD} ${H}:${M}`;
};

const getDateForOutput = (date) => {
    let now = date || (new Date());
    let MM = (now.getMonth() + 1);
        if (MM < 10) { MM = '0' + MM; }
    let DD = now.getDate();
        if (DD < 10) { DD = '0' + DD; }
    let H = now.getHours();
        if (H < 10) { H = '0' + H; }
    let M = now.getMinutes();
        if (M < 10) { M = '0' + M; }
    let S = now.getSeconds();
        if (S < 10) { S = '0' + S; }
    return `${now.getFullYear()}-${MM}-${DD} ${H}:${M}:${S}`;
};

const ensureObjectExists = (obj, key) => {
    if (!(key in obj)) {
        obj[key] = {};
    }
};

const ensureArrayExists = (obj, key) => {
    if (!(key in obj)) {
        obj[key] = [];
    }
};

const getConversations = (time, direction, count, cb) => {
    var lastTimeStamp = time;
    con.getConversations({date: time, direction: direction, number: count})
    .then(res => {
        if (res.conversations) {
            for (let i = 0; i < res.conversations.length; i++) {
                const conv = res.conversations[i];
                ensureObjectExists(conversations, conv.convId);
                conversations[conv.convId] = conv;
                if (conv.lastItemModificationTime < lastTimeStamp) {
                    lastTimeStamp = conv.lastItemModificationTime;
                }
                if (conv.type === 'DIRECT') {
                    let userId = '';
                    for (let j = 0; j < conv.participants.length; j++) {
                        const participant = conv.participants[j];
                        if (participant.userId !== myOwnUser.userId) {
                            userId = participant.userId;
                        }
                    }
                    if (userId.length == 0) {
                        if (conv.creatorId !== myOwnUser.userId) {
                            userId = conv.creatorId;
                        } else {
                            userId = '0';
                        }
                    }
                    ensureObjectExists(users, userId);
                }
            }
            let currentLoadedConversations = Object.keys(conversations).length.toString();
            while (currentLoadedConversations.length < placeHolderSize) { currentLoadedConversations = ' ' + currentLoadedConversations; }
            const msg = `loaded ${currentLoadedConversations} conversations back until ${getDate(new Date(lastTimeStamp))}`;
            if (res.conversations.length === parseInt(count)) {
                printProgress(msg, false);
                getConversations(lastTimeStamp, direction, count, cb);
            } else {
                printProgress(msg, true);
                cb();
            }
        }
    })
    .catch(err => {
        console.error(err && err.message);
        cb();
    });
}

const getUsersByIds = (userIds, cb) => {
    con.getUsersByIds(userIds)
    .then(res => {
        for (let i = 0; i < res.length; i++) {
            users[res[i].userId] = res[i];
        }
        users['0'] = { displayName: 'UNKNOWN USER' };
        let currentLoadedContacts = res.length.toString();
        while (currentLoadedContacts.length < placeHolderSize) { currentLoadedContacts = ' ' + currentLoadedContacts; }
        console.log(`loaded ${currentLoadedContacts} users`);
        cb();
    })
    .catch(err => {
        console.error(err && err.message);
        cb();
    });
}

const getConversationFeed = (convId, convName, time, cb) => {
    // fs.appendFileSync('debug.txt', `getConversationFeed ${convId} ${time}\n`);
    ensureObjectExists(conversations, convId);
    ensureArrayExists(attachments, convId);
    ensureArrayExists(conversations[convId], 'items');
    conversations[convId].name = convName;
    var lastTimeStamp = time;
    con.getConversationFeed(convId, {minTotalItems: 25, date: time, commentsPerThread: 0})
    .then(feed => {
        for (let i = 0; i < feed.conversationThreads.length; i++) {
            if (feed.conversationThreads[i].parentItem) {
                const item = feed.conversationThreads[i].parentItem;
                if (item.creationTime < lastTimeStamp) {
                    lastTimeStamp = item.creationTime;
                }
                ensureObjectExists(users, item.creatorId);
                conversations[convId].items.push(item);
                if (item.attachments) {
                    for (let j = 0; j < item.attachments.length; j++) {
                        if (thumbnailRegEx.test(item.attachments[j].fileName.toLowerCase()) === false) {
                            attachments[convId].push(item.attachments[j]);
                        }
                    }
                }
            }
        }
        let count = conversations[convId].items && conversations[convId].items.length.toString() || undefined;
        while (count && count.length < placeHolderSize) { count = ' ' + count }
        const msg = `loaded ${count} messages from conversation "${convName}"`;
        if (feed.hasOlderThreads == true) {
            count && printProgress(msg, false);
            setTimeout(() => {
                getConversationFeed(convId, convName, lastTimeStamp, cb);
            }, 50);
        } else {
            count && printProgress(msg, true);
            return cb();
        }
    })
    .catch(err => {
        console.error(err && err.message);
        cb();
    });
}

const getConversationThread = (convId, convName, cb) => {
    // fs.appendFileSync('debug.txt', `getConversationThread ${convId} allItems[${conversations[convId].items.length}]\n`);
    let allCount = 0;
    printProgress(`loaded       0 comments from conversation "${convName}"`, false);
    const loadAllThreadComments = (index, timeStamp) => {
        // fs.appendFileSync('debug.txt', `loadAllThreadComments ${index} timeStamp[${timeStamp || 0}]\n`);
        setTimeout(() => {
            if (index < conversations[convId].items.length) {
                var lastTimeStamp = timeStamp || conversations[convId].items[index].creationTime;
                const parentItemId = conversations[convId].items[index].itemId;
                con.getThreadComments(convId, parentItemId, {date: lastTimeStamp})
                .then(thread => {
                    for (let i = 0; i < thread.comments.length; i++) {
                        if (thread.comments[i].parentItemId === parentItemId) {
                            const item = thread.comments[i];
                            if (item.creationTime > lastTimeStamp) {
                                lastTimeStamp = item.creationTime;
                            }
                            ensureObjectExists(users, item.creatorId);
                            ensureArrayExists(threads, parentItemId);
                            threads[parentItemId].push(item);
                            if (item.attachments) {
                                for (let j = 0; j < item.attachments.length; j++) {
                                    if (thumbnailRegEx.test(item.attachments[j].fileName.toLowerCase()) === false) {
                                        attachments[convId].push(item.attachments[j]);
                                    }
                                }
                            }
                        }
                    }
                    allCount += threads[parentItemId] && threads[parentItemId].length || 0;
                    let count = allCount.toString();
                    while (count.length < placeHolderSize) { count = ' ' + count }
                    threads[parentItemId] && threads[parentItemId].length && printProgress(`loaded ${count} comments from conversation "${convName}"`, false);
                    if (thread.hasMoreComments == true) {
                        loadAllThreadComments(index, lastTimeStamp);
                    } else {
                        loadAllThreadComments(index + 1);
                    }
                })
                .catch(err => {
                    console.error(err && err.message);
                    loadAllThreadComments(index + 1);
                });
            } else {
                let count = allCount.toString();
                while (count.length < placeHolderSize) { count = ' ' + count }
                printProgress(`loaded ${count} comments from conversation "${convName}"`, true);
                cb();
            }
        }, 50);
    }
    loadAllThreadComments(0);
}

const getConversationAttachments = (convId, convName, cb) => {
    let dlCount = 0;
    const maxFiles = attachments[convId].length;
    const loadAllAttachments = (index) => {
        // fs.appendFileSync('debug.txt', `loadAllAttachments ${convId} index[${index}] maxFiles[${maxFiles}]\n`);
        if (index < attachments[convId].length) {
            const options = {
                rejectUnauthorized: false,
                host: config.server,
                port: 443,
                path: `/fileapi?fileid=${attachments[convId][index].fileId}&itemid=${attachments[convId][index].itemId}`,
                timeout: 3000,
                headers: {
                    Cookie: `connect.sess=${config.cookie}`
                }
            }
            const name = `${attachments[convId][index].fileId}_${attachments[convId][index].fileName}`;
            const file = fs.createWriteStream(`./output/${convId}/${name}`);
            const req = https.get(options, (res) => {
                res.pipe(file);
                file.on('close', () => {
                    dlCount++;
                    let count = `${dlCount.toString()}/${maxFiles}`;
                    while (count.length < placeHolderSize) { count = ' ' + count }
                    printProgress(`loaded ${count} files    from conversation "${convName}"`, false);
                    loadAllAttachments(index + 1);
                });
            });
            req.on('error', (e) => {
                file.destroy();
                dlCount++;
                console.error(err && err.message);
                loadAllAttachments(index + 1);
            });
            req.end();
        } else {
            let count = `${dlCount.toString()}/${maxFiles}`;
            while (count.length < placeHolderSize) { count = ' ' + count }
            printProgress(`loaded ${count} files    from conversation "${convName}"`, true);
            return cb();
        }
    }
    loadAllAttachments(0);
}
