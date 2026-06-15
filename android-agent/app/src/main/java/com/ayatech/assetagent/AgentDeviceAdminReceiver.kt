package com.ayatech.assetagent

import android.app.admin.DeviceAdminReceiver
import android.content.ComponentName
import android.content.Context

// Registering the app as a device administrator is what blocks the employee
// from uninstalling it — Android won't uninstall an app with an active admin
// until it's deactivated (which staff do from inside the locked config screen).
class AgentDeviceAdminReceiver : DeviceAdminReceiver() {
    companion object {
        fun component(ctx: Context): ComponentName =
            ComponentName(ctx, AgentDeviceAdminReceiver::class.java)
    }
}
