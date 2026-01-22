package com.rtm516.mcxboxbroadcast.core;

import com.rtm516.mcxboxbroadcast.core.configs.CoreConfig;
import com.rtm516.mcxboxbroadcast.core.exceptions.SessionCreationException;
import com.rtm516.mcxboxbroadcast.core.exceptions.SessionUpdateException;
import com.rtm516.mcxboxbroadcast.core.models.session.CreateSessionRequest;
import com.rtm516.mcxboxbroadcast.core.models.session.CreateSessionResponse;
import com.rtm516.mcxboxbroadcast.core.notifications.NotificationManager;
import com.rtm516.mcxboxbroadcast.core.storage.StorageManager;

import com.google.gson.JsonParseException;

import java.util.concurrent.ScheduledExecutorService;

/**
 * Simple manager to authenticate and create sessions on Xbox
 */
public class SubSessionManager extends SessionManagerCore {
    private final SessionManager parent;

    /**
     * Create a new session manager for a sub-session
     *
     * @param id The id of the sub-session
     * @param parent The parent session manager
     * @param storageManager The storage manager to use for storing data
     * @param notificationManager The notification manager to use for sending messages
     * @param logger The logger to use for outputting messages
     */
    public SubSessionManager(String id, SessionManager parent, StorageManager storageManager, NotificationManager notificationManager, Logger logger) {
        super(storageManager, notificationManager, logger.prefixed("Sub-Session " + id));
        this.parent = parent;
    }

    @Override
    public ScheduledExecutorService scheduledThread() {
        return parent.scheduledThread();
    }

    @Override
    public String getSessionId() {
        return sessionInfo.getSessionId();
    }

    public void init(SessionInfo sessionInfo, CoreConfig.FriendSyncConfig friendSyncConfig) throws SessionCreationException, SessionUpdateException {
        this.sessionInfo = new ExpandedSessionInfo("", "", sessionInfo);
        super.init();
        friendManager().init(friendSyncConfig);
    }

    @Override
    protected boolean handleFriendship() {
        // TODO Some form of force flag just in case the master friends list is full

        // Add the main account
        boolean subAdd = friendManager().addIfRequired(parent.getXuid(), parent.getGamertag());

        // Get the main account to add us
        boolean mainAdd = parent.friendManager().addIfRequired(getXuid(), getGamertag());

        return subAdd || mainAdd;
    }

    @Override
    protected void updateSession() throws SessionUpdateException {
        checkConnection();
        String responseBody = super.updateSessionInternal(Constants.CREATE_SESSION.formatted(this.sessionInfo.getSessionId()), new CreateSessionRequest(this.sessionInfo));
        try {
            Constants.GSON.fromJson(responseBody, CreateSessionResponse.class);
        } catch (JsonParseException e) {
            throw new SessionUpdateException("Failed to parse session response: " + e.getMessage());
        }
    }
}
