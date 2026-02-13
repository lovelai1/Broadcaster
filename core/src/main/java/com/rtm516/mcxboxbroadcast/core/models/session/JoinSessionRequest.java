package com.rtm516.mcxboxbroadcast.core.models.session;

import com.rtm516.mcxboxbroadcast.core.ExpandedSessionInfo;
import com.rtm516.mcxboxbroadcast.core.models.session.member.MemberConstantsSystem;
import com.rtm516.mcxboxbroadcast.core.models.session.member.MemberPropertiesSystem;
import com.rtm516.mcxboxbroadcast.core.models.session.member.MemberSubscription;
import com.rtm516.mcxboxbroadcast.core.models.session.member.SessionMember;

import java.util.HashMap;
import java.util.Map;

public class JoinSessionRequest {
    public final Map<String, SessionMember> members;

    public JoinSessionRequest(ExpandedSessionInfo sessionInfo) {
        this(sessionInfo.getXuid(), sessionInfo.getConnectionId(), true);
    }

    public JoinSessionRequest(String xuid, String connectionId, boolean active) {
        Map<String, MemberConstantsSystem> constants = new HashMap<>() {{
            put("system", new MemberConstantsSystem(xuid, true));
        }};
        Map<String, MemberPropertiesSystem> properties = new HashMap<>() {{
            put("system", new MemberPropertiesSystem(active, connectionId, new MemberSubscription()));
        }};

        this.members = new HashMap<>() {{
            put("me", new SessionMember(null, constants, null, properties));
        }};
    }
}
