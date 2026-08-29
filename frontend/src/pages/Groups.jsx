import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  acceptGroupInvite,
  acceptJoinRequest,
  createGroup,
  getGroupInvitations,
  getGroupMessages,
  getGroups,
  getJoinRequests,
  getMyGroups,
  inviteToGroup,
  joinGroup,
  rejectJoinRequest,
  sendGroupMessage,
} from "../api/groupApi";
import { AuthContext } from "../context/authContextValue";
import { socket } from "../sockets/socket";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseEmails = (value) =>
  [...new Set(
    value
      .split(/[\s,;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  )];

const formatInviteStatus = (invites = { sent: [], failed: [] }) => {
  if (invites.sent?.length) {
    return `Invites sent to ${invites.sent.join(", ")}`;
  }

  if (invites.failed?.length) {
    return `Invites saved, but email delivery failed for ${invites.failed.join(", ")}. Check SMTP settings.`;
  }

  return "Study group created. You are the admin.";
};

const getUserId = (user) => user?._id || user?.id || user;
const getMemberCount = (group) => group.members?.length || 0;
const getCreatorName = (group) => group.creatorId?.name || group.creatorId?.email || "Group admin";
const getMessageId = (message) => message?.id || message?._id;

const normalizeMessage = (data) => {
  if (typeof data === "string") {
    return {
      id: `legacy-${Date.now()}-${Math.random()}`,
      message: data,
      type: "text",
      sender: "Student",
      timestamp: new Date().toISOString(),
    };
  }

  return {
    id: data.id || data._id || `message-${Date.now()}-${Math.random()}`,
    _id: data._id || data.id,
    groupId: data.groupId || data.roomId,
    userId: data.userId,
    sender: data.sender || data.senderName || data.userName || "Student",
    message: data.message,
    type: data.type || "text",
    timestamp: data.timestamp || data.createdAt || new Date().toISOString(),
  };
};

const panelClasses = "rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900";
const inputClasses =
  "min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:placeholder:text-gray-500";
const primaryButtonClasses =
  "h-11 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:bg-gray-400 dark:focus:ring-offset-gray-900";
const secondaryButtonClasses =
  "h-10 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 dark:border-gray-700 dark:text-gray-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40";

const Groups = () => {
  const { user } = useContext(AuthContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const inviteHandledRef = useRef(false);

  const [groupName, setGroupName] = useState("");
  const [inviteEmails, setInviteEmails] = useState("");
  const [extraInviteEmails, setExtraInviteEmails] = useState("");
  const [activeGroup, setActiveGroup] = useState(null);
  const [activeRoom, setActiveRoom] = useState("");
  const [allGroups, setAllGroups] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [highlightedInviteId, setHighlightedInviteId] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(socket.connected);
  const [roomStatus, setRoomStatus] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [busy, setBusy] = useState(false);
  const messagesEndRef = useRef(null);

  const myGroupIds = useMemo(() => new Set(myGroups.map((group) => group._id)), [myGroups]);
  const otherGroups = useMemo(
    () => allGroups.filter((group) => !myGroupIds.has(group._id)),
    [allGroups, myGroupIds]
  );
  const pendingRequestCount = otherGroups.filter((group) => group.viewerStatus === "requested").length;

  useEffect(() => {
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => {
      setConnected(false);
      setRoomStatus("Live room disconnected");
    };

    const addMessage = (data) => {
      const nextMessage = normalizeMessage(data);
      if (!nextMessage.message) return;

      setMessages((prev) => {
        const nextId = getMessageId(nextMessage);
        if (nextId && prev.some((item) => getMessageId(item) === nextId)) return prev;
        return [...prev, nextMessage];
      });
    };

    socket.connect();
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("study-room-message", addMessage);
    socket.on("session-updated", addMessage);
    socket.on("user-joined", addMessage);
    socket.on("group-message", addMessage);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("study-room-message", addMessage);
      socket.off("session-updated", addMessage);
      socket.off("user-joined", addMessage);
      socket.off("group-message", addMessage);
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const loadMessages = useCallback(async (groupId) => {
    setMessagesLoading(true);

    try {
      const data = await getGroupMessages(groupId, { limit: 75 });
      setMessages((data.messages || []).map(normalizeMessage));
    } catch (error) {
      setMessages([]);
      setRoomStatus(error.response?.data?.message || "Could not load previous messages");
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const openStudyRoom = useCallback((roomId, group = null) => {
    const nextRoom = roomId?.trim();
    if (!nextRoom) return;

    if (!connected) {
      socket.connect();
    }

    if (activeRoom && activeRoom !== nextRoom) {
      socket.emit("leave-study-room", activeRoom);
    }

    socket.timeout(5000).emit("join-study-room", nextRoom, (error, response) => {
      if (error || !response?.success) {
        setRoomStatus(response?.message || "Could not open the study group room");
        return;
      }

      setActiveRoom(response.roomId);
      loadMessages(response.roomId);
      setRoomStatus(`${group?.name || response.roomId} is open`);
    });
  }, [activeRoom, connected, loadMessages]);

  const loadGroupLists = useCallback(async () => {
    const [groupsResult, myGroupsResult, invitationsResult, joinRequestsResult] = await Promise.allSettled([
      getGroups(),
      getMyGroups(),
      getGroupInvitations(),
      getJoinRequests(),
    ]);

    const groupsData = groupsResult.status === "fulfilled" ? groupsResult.value : {};
    const myGroupsData = myGroupsResult.status === "fulfilled" ? myGroupsResult.value : {};
    const invitationsData = invitationsResult.status === "fulfilled" ? invitationsResult.value : {};
    const joinRequestsData = joinRequestsResult.status === "fulfilled" ? joinRequestsResult.value : {};

    setAllGroups(groupsData.groups || []);
    setMyGroups(myGroupsData.groups || []);
    setPendingInvites(invitationsData.invitations || []);
    setJoinRequests(joinRequestsData.requests || []);
  }, []);

  useEffect(() => {
    loadGroupLists();
  }, [loadGroupLists]);

  useEffect(() => {
    const groupId = searchParams.get("groupId");

    if (!groupId || inviteHandledRef.current) return;

    inviteHandledRef.current = true;
    setHighlightedInviteId(groupId);
    setRoomStatus("Invitation opened. Accept it below to join the study group.");
    setSearchParams({});
  }, [searchParams, setSearchParams]);

  const handleCreateGroup = async (event) => {
    event.preventDefault();

    const name = groupName.trim();
    const emails = parseEmails(inviteEmails);
    const invalidEmails = emails.filter((email) => !emailRegex.test(email));

    if (!name) {
      setRoomStatus("Enter a study group name first");
      return;
    }

    if (invalidEmails.length) {
      setRoomStatus(`Check these email addresses: ${invalidEmails.join(", ")}`);
      return;
    }

    setBusy(true);
    setRoomStatus("Creating study group...");

    try {
      const data = await createGroup({
        name,
        subject: "General",
        inviteEmails: emails,
        isPublic: false,
      });

      setActiveGroup(data.group);
      setGroupName("");
      setInviteEmails("");
      openStudyRoom(data.group._id, data.group);
      await loadGroupLists();
      setRoomStatus(formatInviteStatus(data.invites));
    } catch (error) {
      setRoomStatus(error.response?.data?.message || "Could not create study group");
    } finally {
      setBusy(false);
    }
  };

  const handleSendInvites = async (event) => {
    event.preventDefault();

    if (!activeGroup?._id) {
      setRoomStatus("Open a study group before sending invites");
      return;
    }

    const emails = parseEmails(extraInviteEmails);
    const invalidEmails = emails.filter((email) => !emailRegex.test(email));

    if (!emails.length) {
      setRoomStatus("Add at least one email address");
      return;
    }

    if (invalidEmails.length) {
      setRoomStatus(`Check these email addresses: ${invalidEmails.join(", ")}`);
      return;
    }

    setBusy(true);
    setRoomStatus("Sending invites...");

    try {
      const data = await inviteToGroup(activeGroup._id, emails);
      setActiveGroup(data.group);
      setExtraInviteEmails("");
      await loadGroupLists();
      setRoomStatus(formatInviteStatus(data.invites));
    } catch (error) {
      setRoomStatus(error.response?.data?.message || "Could not send invites");
    } finally {
      setBusy(false);
    }
  };

  const handleAcceptInvite = async (groupId) => {
    setBusy(true);
    setRoomStatus("Accepting invitation...");

    try {
      const data = await acceptGroupInvite(groupId);
      setActiveGroup(data.group);
      setHighlightedInviteId("");
      await loadGroupLists();
      openStudyRoom(data.group._id, data.group);
      setRoomStatus(data.message || `You joined ${data.group.name}`);
    } catch (error) {
      setRoomStatus(error.response?.data?.message || "Could not accept invitation");
    } finally {
      setBusy(false);
    }
  };

  const handleRequestJoin = async (groupId) => {
    setBusy(true);
    setRoomStatus("Sending join request...");

    try {
      const data = await joinGroup(groupId);
      await loadGroupLists();
      setRoomStatus(data.message || "Join request sent");
    } catch (error) {
      setRoomStatus(error.response?.data?.message || "Could not send join request");
    } finally {
      setBusy(false);
    }
  };

  const handleAcceptJoinRequest = async (request) => {
    const userId = getUserId(request.user);
    if (!userId) return;

    setBusy(true);
    setRoomStatus("Approving request...");

    try {
      const data = await acceptJoinRequest(request.groupId, userId);
      await loadGroupLists();
      setRoomStatus(data.message || "Join request accepted");
    } catch (error) {
      setRoomStatus(error.response?.data?.message || "Could not accept join request");
    } finally {
      setBusy(false);
    }
  };

  const handleRejectJoinRequest = async (request) => {
    const userId = getUserId(request.user);
    if (!userId) return;

    setBusy(true);
    setRoomStatus("Rejecting request...");

    try {
      const data = await rejectJoinRequest(request.groupId, userId);
      await loadGroupLists();
      setRoomStatus(data.message || "Join request rejected");
    } catch (error) {
      setRoomStatus(error.response?.data?.message || "Could not reject join request");
    } finally {
      setBusy(false);
    }
  };

  const handleOpenGroup = (group) => {
    setActiveGroup(group);
    openStudyRoom(group._id, group);
  };

  const sendMessage = async (event) => {
    event?.preventDefault();

    if (!activeRoom) {
      setRoomStatus("Open one of your study groups before sending messages");
      return;
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    setSendingMessage(true);

    try {
      const data = await sendGroupMessage(activeRoom, trimmedMessage);
      const savedMessage = normalizeMessage(data.message);

      setMessages((prev) => {
        const savedId = getMessageId(savedMessage);
        if (savedId && prev.some((item) => getMessageId(item) === savedId)) return prev;
        return [...prev, savedMessage];
      });
      setMessage("");
      setRoomStatus("");

      socket.emit("study-room-message", {
        roomId: activeRoom,
        ...savedMessage,
      });
    } catch (error) {
      setRoomStatus(error.response?.data?.message || "Message was not sent");
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-1">
      <section className="rounded-lg border border-indigo-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase text-indigo-600 dark:text-indigo-400">Study Groups</p>
            <h1 className="mt-1 text-3xl font-bold text-gray-950 dark:text-white">Study together with classmates</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
              Create a named group like "Math Exam Prep", invite classmates, approve requests, and chat in a live study room.
            </p>
          </div>

          <div className="grid min-w-full grid-cols-2 gap-3 sm:min-w-[28rem] sm:grid-cols-4">
            <Metric label="Mine" value={myGroups.length} tone="indigo" />
            <Metric label="Invites" value={pendingInvites.length} tone="amber" />
            <Metric label="Approvals" value={joinRequests.length} tone="emerald" />
            <Metric label="Requested" value={pendingRequestCount} tone="sky" />
          </div>
        </div>

        <form onSubmit={handleCreateGroup} className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_auto]">
          <input
            aria-label="Study group name"
            placeholder="Study group name, e.g. Math Exam Prep"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            className={inputClasses}
          />
          <input
            aria-label="Classmate email addresses"
            placeholder="Classmate emails to invite"
            value={inviteEmails}
            onChange={(event) => setInviteEmails(event.target.value)}
            className={inputClasses}
          />
          <button type="submit" disabled={busy} className={`${primaryButtonClasses} lg:w-36`}>
            Create
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 dark:border-gray-800 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 text-sm">
            <span className={`inline-flex rounded-full px-3 py-1 font-semibold ${connected ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"}`}>
              {connected ? "Live rooms online" : "Connecting"}
            </span>
            {activeGroup && (
              <span className="ml-2 text-gray-600 dark:text-gray-300">
                Active: <span className="font-semibold text-gray-900 dark:text-white">{activeGroup.name}</span>
              </span>
            )}
          </div>
          {roomStatus && <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{roomStatus}</p>}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className={panelClasses}>
          <PanelHeader title="My Study Groups" count={myGroups.length} />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {myGroups.length === 0 && <EmptyState text="Create or accept a study group invite to see it here." />}
            {myGroups.map((group) => (
              <GroupCard
                key={group._id}
                group={group}
                badge={group.creatorId?._id === getUserId(user) ? "Admin" : "Member"}
                action={
                  <button type="button" onClick={() => handleOpenGroup(group)} className={secondaryButtonClasses}>
                    Open Room
                  </button>
                }
              />
            ))}
          </div>
        </div>

        <div className={panelClasses}>
          <PanelHeader title="Invites For You" count={pendingInvites.length} />
          <div className="mt-4 space-y-3">
            {pendingInvites.length === 0 && <EmptyState text="No study group invites yet." />}
            {pendingInvites.map((invite) => (
              <RequestCard
                key={invite.groupId}
                highlighted={highlightedInviteId === invite.groupId}
                title={invite.groupName}
                detail={`Invited by ${invite.invitedBy?.name || invite.invitedBy?.email || "Group admin"}`}
                action={
                  <button
                    type="button"
                    onClick={() => handleAcceptInvite(invite.groupId)}
                    disabled={busy}
                    className={primaryButtonClasses}
                  >
                    Accept
                  </button>
                }
              />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className={panelClasses}>
          <PanelHeader title="Find Study Groups" count={otherGroups.length} />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {otherGroups.length === 0 && <EmptyState text="No study groups are available to request right now." />}
            {otherGroups.map((group) => (
              <GroupCard
                key={group._id}
                group={group}
                badge={group.viewerStatus === "requested" ? "Pending" : "Available"}
                action={
                  <button
                    type="button"
                    onClick={() => handleRequestJoin(group._id)}
                    disabled={busy || group.viewerStatus === "requested"}
                    className={secondaryButtonClasses}
                  >
                    {group.viewerStatus === "requested" ? "Requested" : "Request Access"}
                  </button>
                }
              />
            ))}
          </div>
        </div>

        <div className={panelClasses}>
          <PanelHeader title="Member Approvals" count={joinRequests.length} />
          <div className="mt-4 space-y-3">
            {joinRequests.length === 0 && <EmptyState text="No requests waiting for your approval." />}
            {joinRequests.map((request) => (
              <RequestCard
                key={`${request.groupId}-${request.requestId}`}
                title={request.groupName}
                detail={`${request.user?.name || request.user?.email || "A student"} wants to join`}
                action={
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleAcceptJoinRequest(request)}
                      disabled={busy}
                      className={primaryButtonClasses}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectJoinRequest(request)}
                      disabled={busy}
                      className={secondaryButtonClasses}
                    >
                      Decline
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        </div>
      </section>

      <section className={panelClasses}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-950 dark:text-white">Live Room</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {activeGroup ? activeGroup.name : "Open one of your study groups to start chatting."}
            </p>
          </div>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {messages.length} message{messages.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="mt-4 min-h-44 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {messages.length === 0 && <EmptyState text={activeRoom ? "No messages yet." : "Your study group chat will appear here."} />}
            {messages.map((msg, index) => (
              <div
                key={msg.id || `${msg.message}-${index}`}
                className={`rounded-lg px-3 py-2 text-sm ${
                  msg.type === "system"
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200"
                    : "bg-white text-gray-800 shadow-sm dark:bg-gray-900 dark:text-gray-100"
                }`}
              >
                {msg.type !== "system" && (
                  <div className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {msg.sender || "Student"}
                  </div>
                )}
                <div>{msg.message}</div>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={sendMessage} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input
            placeholder={activeRoom ? "Message this study group" : "Open a study group first"}
            value={message}
            disabled={!activeRoom}
            onChange={(event) => setMessage(event.target.value)}
            className={`${inputClasses} disabled:cursor-not-allowed disabled:opacity-60`}
          />
          <button type="submit" disabled={!activeRoom} className={`${primaryButtonClasses} sm:w-24`}>
            Send
          </button>
        </form>

        {activeGroup && (
          <form onSubmit={handleSendInvites} className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              type="text"
              placeholder={`Invite more people to ${activeGroup.name}`}
              value={extraInviteEmails}
              onChange={(event) => setExtraInviteEmails(event.target.value)}
              className={inputClasses}
            />
            <button type="submit" disabled={busy} className={`${secondaryButtonClasses} sm:w-32`}>
              Send Invite
            </button>
          </form>
        )}
      </section>
    </div>
  );
};

function Metric({ label, value, tone }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    sky: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  };

  return (
    <div className={`rounded-lg px-3 py-3 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function PanelHeader({ title, count }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold text-gray-950 dark:text-white">{title}</h2>
      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
        {count}
      </span>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400">
      {text}
    </p>
  );
}

function GroupCard({ group, badge, action }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-gray-50 p-4 transition hover:border-indigo-200 hover:bg-white dark:border-gray-800 dark:bg-gray-950 dark:hover:border-indigo-900 dark:hover:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-bold text-gray-950 dark:text-white">{group.name}</h3>
          <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">{getCreatorName(group)}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-800">
          {badge}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {getMemberCount(group)} member{getMemberCount(group) === 1 ? "" : "s"}
        </p>
        {action}
      </div>
    </article>
  );
}

function RequestCard({ highlighted = false, title, detail, action }) {
  return (
    <article
      className={`rounded-lg border p-4 ${
        highlighted
          ? "border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/40"
          : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950"
      }`}
    >
      <div className="min-w-0">
        <h3 className="truncate font-bold text-gray-950 dark:text-white">{title}</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{detail}</p>
      </div>
      <div className="mt-3">{action}</div>
    </article>
  );
}

export default Groups;
