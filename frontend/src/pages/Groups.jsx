import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  acceptGroupInvite,
  createGroup,
  getGroupInvitations,
  getGroupMessages,
  getGroups,
  getMyGroups,
  joinGroup,
  leaveGroup,
  sendGroupMessage,
} from "../api/groupApi";
import { socket } from "../sockets/socket";

const getErrorMessage = (error) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  (error?.code === "ERR_NETWORK"
    ? "Cannot reach the backend server. Start it from the backend folder."
    : "Could not update study groups right now.");

const getMemberCount = (group) => group.members?.length || 0;
const getCreatorName = (group) => group.creatorId?.name || group.creatorId?.email || "Group admin";

const formatDateTime = (value) => {
  if (!value) return "No messages yet";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No messages yet";

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const normalizeMessage = (data) => ({
  id: data?.id || data?._id || `message-${Date.now()}-${Math.random()}`,
  _id: data?._id || data?.id,
  groupId: data?.groupId || data?.roomId,
  userId: data?.userId,
  sender: data?.sender || data?.senderName || "Student",
  message: data?.message || "",
  type: data?.type || "text",
  timestamp: data?.timestamp || data?.createdAt || new Date().toISOString(),
});

function EmptyState({ text }) {
  return (
    <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400">
      {text}
    </p>
  );
}

function StatCard({ label, value, tone }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  };

  return (
    <div className={`rounded-xl px-4 py-4 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function GroupCard({ group, active, onOpen, onJoin, onLeave, busy, discover = false }) {
  return (
    <article
      className={`rounded-xl border p-4 transition ${
        active
          ? "border-indigo-300 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/30"
          : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <h3 className="truncate font-semibold text-gray-950 dark:text-white">{group.name}</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{getCreatorName(group)}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {group.subject || "General"} | {getMemberCount(group)} member{getMemberCount(group) === 1 ? "" : "s"}
          </p>
        </button>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-800">
          {discover ? (group.viewerStatus === "requested" ? "Requested" : "Public") : "My Group"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          {active ? "Close" : "Open"}
        </button>
        {discover ? (
          <button
            type="button"
            onClick={onJoin}
            disabled={busy || group.viewerStatus === "requested"}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40"
          >
            {group.viewerStatus === "requested" ? "Requested" : "Request Access"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onLeave}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-gray-700 dark:text-gray-200 dark:hover:border-rose-700 dark:hover:bg-rose-950/40"
          >
            Leave
          </button>
        )}
      </div>
    </article>
  );
}

function MessageBubble({ message }) {
  const isSystem = message.type === "system";

  return (
    <div
      className={`max-w-[92%] rounded-xl px-3 py-2 text-sm ${
        isSystem
          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200"
          : "bg-white text-gray-800 shadow-sm dark:bg-gray-900 dark:text-gray-100"
      }`}
    >
      {!isSystem && <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{message.sender || "Student"}</p>}
      <p className="whitespace-pre-wrap leading-6">{message.message}</p>
      <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">{formatDateTime(message.timestamp)}</p>
    </div>
  );
}

export default function Groups() {
  const [groupName, setGroupName] = useState("");
  const [groupSubject, setGroupSubject] = useState("General");
  const [groupDescription, setGroupDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [myGroups, setMyGroups] = useState([]);
  const [discoverGroups, setDiscoverGroups] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [activeRoom, setActiveRoom] = useState("");
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [connected, setConnected] = useState(socket.connected);
  const messagesEndRef = useRef(null);

  const myGroupIds = useMemo(() => new Set(myGroups.map((group) => group._id)), [myGroups]);

  const loadLists = useCallback(async () => {
    setLoading(true);

    const [myGroupsResult, groupsResult, invitesResult] = await Promise.allSettled([
      getMyGroups(),
      getGroups(),
      getGroupInvitations(),
    ]);

    const myGroupsData = myGroupsResult.status === "fulfilled" ? myGroupsResult.value : {};
    const groupsData = groupsResult.status === "fulfilled" ? groupsResult.value : {};
    const invitesData = invitesResult.status === "fulfilled" ? invitesResult.value : {};

    const nextMyGroups = myGroupsData.groups || myGroupsData.userGroups || [];
    const nextGroups = groupsData.groups || [];
    const nextMyGroupIds = new Set(nextMyGroups.map((group) => group._id));

    setMyGroups(nextMyGroups);
    setDiscoverGroups(nextGroups.filter((group) => !nextMyGroupIds.has(group._id)));
    setPendingInvites(invitesData.invitations || []);
    setLoading(false);
  }, []);

  const loadMessages = useCallback(async (groupId) => {
    setMessagesLoading(true);

    try {
      const data = await getGroupMessages(groupId, { limit: 75 });
      setMessages((data.messages || []).map(normalizeMessage));
    } catch (error) {
      setMessages([]);
      setStatus(getErrorMessage(error));
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => {
      setConnected(false);
      setStatus("Live room disconnected");
    };

    const handleRoomMessage = (data) => {
      const nextMessage = normalizeMessage(data);
      if (!nextMessage.message) return;

      setMessages((prev) => {
        if (prev.some((item) => item.id === nextMessage.id || item._id === nextMessage.id)) return prev;
        return [...prev, nextMessage];
      });
    };

    socket.connect();
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("study-room-message", handleRoomMessage);
    socket.on("user-joined", handleRoomMessage);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("study-room-message", handleRoomMessage);
      socket.off("user-joined", handleRoomMessage);
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const closeActiveRoom = useCallback(() => {
    if (activeRoom) {
      socket.emit("leave-study-room", activeRoom);
    }

    setActiveGroup(null);
    setActiveRoom("");
    setMessages([]);
    setMessage("");
    setStatus("");
  }, [activeRoom]);

  const openGroup = useCallback(
    async (group) => {
      if (!group?._id) return;

      if (activeRoom === group._id) {
        closeActiveRoom();
        return;
      }

      if (!connected) {
        socket.connect();
      }

      if (activeRoom) {
        socket.emit("leave-study-room", activeRoom);
      }

      setActiveGroup(group);
      setActiveRoom(group._id);
      setStatus(`Opening ${group.name}...`);

      socket.timeout(5000).emit("join-study-room", group._id, (error, response) => {
        if (error || !response?.success) {
          setStatus(response?.message || "Could not open the study room");
          setActiveRoom("");
          return;
        }

        setActiveRoom(response.roomId);
        setStatus(`${group.name} is open`);
        loadMessages(response.roomId);
      });
    },
    [activeRoom, closeActiveRoom, connected, loadMessages]
  );

  const handleCreateGroup = async (event) => {
    event.preventDefault();

    const name = groupName.trim();
    const subject = groupSubject.trim() || "General";

    if (!name) {
      setStatus("Please add a group name first.");
      return;
    }

    setBusy(true);
    setStatus("Creating group...");

    try {
      const data = await createGroup({
        name,
        subject,
        description: groupDescription.trim(),
        isPublic,
      });

      setGroupName("");
      setGroupSubject("General");
      setGroupDescription("");
      setIsPublic(false);

      await loadLists();
      setActiveGroup(data.group);
      setStatus(data.message || "Study group created.");
      openGroup(data.group);
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleJoinGroup = async (groupId) => {
    setBusy(true);
    setStatus("Sending join request...");

    try {
      const data = await joinGroup(groupId);
      await loadLists();
      setStatus(data.message || "Join request sent");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleAcceptInvite = async (groupId) => {
    setBusy(true);
    setStatus("Accepting invite...");

    try {
      const data = await acceptGroupInvite(groupId);
      await loadLists();
      setActiveGroup(data.group);
      setStatus(data.message || `You joined ${data.group.name}`);
      openGroup(data.group);
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!activeGroup?._id) return;

    setBusy(true);
    setStatus("Leaving group...");

    try {
      await leaveGroup(activeGroup._id);
      closeActiveRoom();
      await loadLists();
      setStatus("Left the group");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();

    if (!activeRoom) {
      setStatus("Open a study group first.");
      return;
    }

    const trimmed = message.trim();
    if (!trimmed) return;

    setBusy(true);

    try {
      const data = await sendGroupMessage(activeRoom, trimmed);
      const savedMessage = normalizeMessage(data.message);

      setMessages((prev) => {
        if (prev.some((item) => item.id === savedMessage.id || item._id === savedMessage.id)) return prev;
        return [...prev, savedMessage];
      });
      setMessage("");
      setStatus("");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const activeMyGroup = activeGroup && myGroupIds.has(activeGroup._id);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-1">
      <section className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              Study Groups
            </p>
            <h1 className="mt-1 text-3xl font-bold text-gray-950 dark:text-white">Small group study, kept simple</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
              Create a group, join one, and chat live without the extra clutter.
            </p>
          </div>

          <div className="grid min-w-full grid-cols-3 gap-3 sm:min-w-[24rem]">
            <StatCard label="My Groups" value={myGroups.length} tone="indigo" />
            <StatCard label="Invites" value={pendingInvites.length} tone="emerald" />
            <StatCard label="Discover" value={discoverGroups.length} tone="amber" />
          </div>
        </div>

        {status && (
          <p className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
            {status}
          </p>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-950 dark:text-white">Create Group</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Name it, choose a subject, and start a room.</p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                Quick setup
              </span>
            </div>

            <form onSubmit={handleCreateGroup} className="mt-5 space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="Group name"
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />
                <input
                  value={groupSubject}
                  onChange={(event) => setGroupSubject(event.target.value)}
                  placeholder="Subject"
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />
              </div>

              <textarea
                value={groupDescription}
                onChange={(event) => setGroupDescription(event.target.value)}
                placeholder="Optional description"
                className="min-h-24 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              />

              <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(event) => setIsPublic(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Make it public so others can discover it
              </label>

              <button
                type="submit"
                disabled={busy}
                className="h-11 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {busy ? "Working..." : "Create Group"}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-950 dark:text-white">Pending Invites</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Groups you were invited to join.</p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {pendingInvites.length}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {pendingInvites.length ? (
                pendingInvites.map((invite) => (
                  <div
                    key={invite.groupId}
                    className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-gray-950 dark:text-white">{invite.groupName}</h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Invited by {invite.invitedBy?.name || invite.invitedBy?.email || "Group admin"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAcceptInvite(invite.groupId)}
                        disabled={busy}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                      >
                        Accept
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState text="No invites right now." />
              )}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-950 dark:text-white">My Groups</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Tap a card to open or close the room.</p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {myGroups.length}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {myGroups.length ? (
                myGroups.map((group) => (
                  <GroupCard
                    key={group._id}
                    group={group}
                    active={activeRoom === group._id}
                    onOpen={() => openGroup(group)}
                    onLeave={handleLeaveGroup}
                    busy={busy}
                  />
                ))
              ) : (
                <EmptyState text={loading ? "Loading your groups..." : "Create a group or accept an invite to get started."} />
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-950 dark:text-white">Discover</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Public groups you can request access to.</p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {discoverGroups.length}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {discoverGroups.length ? (
                discoverGroups.map((group) => (
                  <GroupCard
                    key={group._id}
                    group={group}
                    active={activeRoom === group._id}
                    onOpen={() => openGroup(group)}
                    onJoin={() => handleJoinGroup(group._id)}
                    busy={busy}
                    discover
                  />
                ))
              ) : (
                <EmptyState text="No public groups available right now." />
              )}
            </div>
          </section>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-950 dark:text-white">
              {activeGroup ? activeGroup.name : "Live Room"}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {activeGroup
                ? `${getMemberCount(activeGroup)} member${getMemberCount(activeGroup) === 1 ? "" : "s"}`
                : "Open a group to start chatting."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                connected
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
              }`}
            >
              {connected ? "Live" : "Connecting"}
            </span>
            {activeGroup && activeMyGroup && (
              <button
                type="button"
                onClick={handleLeaveGroup}
                disabled={busy}
                className="rounded-full border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:border-rose-700 dark:hover:bg-rose-950/40"
              >
                Leave Group
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
          <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
            {activeRoom ? (
              <>
                {messagesLoading && <EmptyState text="Loading messages..." />}
                {!messagesLoading && messages.length === 0 && <EmptyState text="No messages yet. Say hello first." />}
                {messages.map((msg, index) => (
                  <MessageBubble key={msg.id || `${msg.message}-${index}`} message={msg} />
                ))}
                <div ref={messagesEndRef} />
              </>
            ) : (
              <EmptyState text="Your study group chat will appear here." />
            )}
          </div>
        </div>

        <form onSubmit={handleSendMessage} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={activeRoom ? "Write a message..." : "Open a group to chat"}
            disabled={!activeRoom}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
          <button
            type="submit"
            disabled={!activeRoom || busy}
            className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            Send
          </button>
        </form>
      </section>
    </div>
  );
}
