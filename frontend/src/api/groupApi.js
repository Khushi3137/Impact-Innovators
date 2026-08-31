import api from "./axios";

export const createGroup = async (data) => {
  const res = await api.post("/groups", data);
  return res.data;
};

export const joinGroup = async (groupId) => {
  const res = await api.post(`/groups/${groupId}/join`);
  return res.data;
};

export const getGroups = async () => {
  const res = await api.get("/groups");
  return res.data;
};

export const getMyGroups = async () => {
  const res = await api.get("/groups/my-groups");
  return res.data;
};

export const getGroupInvitations = async () => {
  const res = await api.get("/groups/invitations");
  return res.data;
};

export const acceptGroupInvite = async (groupId) => {
  const res = await api.post(`/groups/${groupId}/accept-invite`);
  return res.data;
};

export const leaveGroup = async (groupId) => {
  const res = await api.post(`/groups/${groupId}/leave`);
  return res.data;
};

export const getJoinRequests = async () => {
  const res = await api.get("/groups/join-requests");
  return res.data;
};

export const acceptJoinRequest = async (groupId, userId) => {
  const res = await api.post(`/groups/${groupId}/join-requests/${userId}/accept`);
  return res.data;
};

export const rejectJoinRequest = async (groupId, userId) => {
  const res = await api.post(`/groups/${groupId}/join-requests/${userId}/reject`);
  return res.data;
};

export const inviteToGroup = async (groupId, emails) => {
  const res = await api.post(`/groups/${groupId}/invite`, { emails });
  return res.data;
};

export const getGroupMessages = async (groupId, params = {}) => {
  const res = await api.get(`/groups/${groupId}/messages`, { params });
  return res.data;
};

export const sendGroupMessage = async (groupId, message) => {
  const res = await api.post(`/groups/${groupId}/messages`, { message });
  return res.data;
};
