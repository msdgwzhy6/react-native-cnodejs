import { get, post } from '../../utils/request';
import WebIM from '../../utils/webIM';
import { moment } from '../../utils/tool';

export async function queryNotics(params) {
  const { accesstoken, mdrender = false } = params
  return get(`/messages?accesstoken=${accesstoken}&mdrender=${mdrender}`);
}

export async function register(params) {
  const { username, password, nickname } = params
  const body = { username, password, nickname: nickname || username }
  return WebIM.api.register(body);
}

export async function attemptLogin(params) {
  const { username, password } = params
  const body = { username, password, grant_type: 'password', timestamp: +new Date() }
  return WebIM.api.login(body);
}

export async function loginWebim(params) {
  const { apiURL, appkey } = WebIM.config
  const { username, password } = params
  var options = { apiUrl: apiURL, user: username, pwd: password, appKey: appkey };
  WebIM.conn.open(options);
}

export async function tokenLoginWebim(params) {
  const { apiURL, appkey } = WebIM.config
  const { user, accessToken } = params
  var options = { apiUrl: apiURL, user, accessToken, appKey: appkey };
  WebIM.conn.open(options);
}

export async function addFriends(params) {
  const { username, message } = params
  WebIM.conn.subscribe({ to: username, message });
}

export async function removeFriends(params) {
  const { username } = params
  const success = () => { WebIM.conn.unsubscribed({ to: username }); console.log('=== remove friend success ===') }
  const error = () => console.log(`=== remove friend error ===`)
  WebIM.conn.removeRoster({ to: username, success, error });
}

export async function sendTxtMessage(params) {
  const { msg, to, chatType = 'singleChat', roomType = false } = params
  var id = WebIM.conn.getUniqueId();
  var message = new WebIM.message('txt', id);
  const success = (id, serverMsgId) => console.log('=== send message success ===')
  const fail = (e) => console.log(`=== Send message error: ${e} ===`)
  message.set({ msg, to, roomType, success, fail });
  message.body.chatType = chatType;
  WebIM.conn.send(message.body);
}

export async function mark_oneMessages(params) {
  const { accesstoken, msg_id } = params
  const body = { accesstoken }
  return post(`/message/mark_one/${msg_id}`, body);
}

export function parseNotics(data) {
  const has_read_messages = data.has_read_messages.map(message => {
    const last_reply_at = message.topic.last_reply_at
    const create_at = message.reply.create_at
    message.topic.last_reply_at = moment(last_reply_at).startOf('minute').fromNow()
    message.reply.create_at = moment(create_at).startOf('minute').fromNow()
    return message
  })
  const hasnot_read_messages = data.hasnot_read_messages.map(message => {
    const last_reply_at = message.topic.last_reply_at
    const create_at = message.reply.create_at
    message.topic.last_reply_at = moment(last_reply_at).startOf('minute').fromNow()
    message.reply.create_at = moment(create_at).startOf('minute').fromNow()
    return message
  })
  return { has_read_messages, hasnot_read_messages }
}

export function parseRead(data, state) {
  const { marked_msg_id } = data
  const hasnot_read_messages = state.hasnot_read_messages.filter(messages => messages.id !== marked_msg_id);
  const read_messages = state.hasnot_read_messages.map((messages) => {
    if (messages.id === marked_msg_id) {
      messages.has_read = true
      return messages
    }
  });
  const has_read_messages = state.has_read_messages.unshift(read_messages[0]).concat()
  return { has_read_messages, hasnot_read_messages }
}

export function parseMessage(state, payload) {
  const { user: { name }, message } = payload
  const total_messages = state.total_messages;
  const user_messages = total_messages[name] || []
  const messages = [message, ...user_messages]
  total_messages[name] = messages
  const chat_user = { name, avatar: 'https://facebook.github.io/react/img/logo_og.png', ...message }
  chat_user.createdAt = moment(chat_user.createdAt).format('HH:mm');
  const filter_chats = state.chat_history.filter(chat => chat.name !== name)
  const chat_history = [chat_user, ...filter_chats]
  return { messages, total_messages, chat_history }
}

export function parseSigleHistory(state, payload) {
  const { name } = payload
  const total_messages = state.total_messages;
  delete total_messages[name]
  const chat_history = state.chat_history.map(chat => {
    if (chat.name === name) chat = { ...chat, text: '', createdAt: '' }
    return chat
  })
  return { messages: [], total_messages, chat_history }
}

export function parseSigleChat(state, payload) {
  const { name } = payload
  const total_messages = state.total_messages;
  delete total_messages[name]
  const chat_history = state.chat_history.filter(chat => chat.name !== name)
  return { messages: [], total_messages, chat_history }
}

export function parseFriends(state, payload) {
  const { name, subscription } = payload
  let contacts = state.contacts.filter(contact => contact.name != name)
  switch (subscription) {
    case 'remove': break;
    case 'both': contacts = [payload, ...state.contacts]; break;
    default: contacts = state.contacts; break;
  }
  return { contacts }
}

export function handlePresence(state, payload) {
  const { from, type } = payload
  let contacts = state.contacts.filter(contact => contact.name != from)
  let strangers = state.strangers.filter(stranger => stranger.name != from)
  const roster = {
    groups: [],
    jid: `magnussen#cnodejs_${from}@easemob.com`,
    avatar: 'https://facebook.github.io/react/img/logo_og.png',
    name: from,
    subscription: "none"
  }
  switch (type) {
    //若e.status中含有[resp:true],则表示为对方同意好友后反向添加自己为好友的消息，demo中发现此类消息，默认同意操作，完成双方互为好友；如果不含有[resp:true]，则表示为正常的对方请求添加自己为好友的申请消息。
    case 'subscribe': strangers = [roster, ...strangers]; break;
    //(发送者允许接收者接收他们的出席信息)，即别人同意你加他为好友
    case 'subscribed': concat.subscription = 'both'; contacts = [roster, ...contacts]; break;
    //（发送者取消订阅另一个实体的出席信息）,即删除现有好友
    case 'unsubscribe': break;
    //（订阅者的请求被拒绝或以前的订阅被取消），即对方单向的删除了好友
    case 'unsubscribed': contacts = [roster, ...contacts]; break;
    default: break;
  }
  return { contacts, strangers }
}

export function parseHistory(messages) {
  const history = messages.map(message => {
    if (typeof message.createdAt === 'object' || message.createdAt.length > 16) {
      message.createdAt = moment(message.createdAt).format('HH:mm');
      // message.createdAt = moment(message.createdAt).startOf('minute').fromNow()
    }
    return message
  })
  return history
}

export function parseRosters(rosters) {
  const contacts = [];
  const strangers = [];
  rosters.map(roster => {
    roster.avatar = 'https://facebook.github.io/react/img/logo_og.png'
    if (roster.subscription === 'both' || roster.subscription === 'to') contacts.push(roster)
    else strangers.push(roster)
  })
  return { contacts, strangers }
}