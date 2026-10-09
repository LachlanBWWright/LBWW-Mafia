use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

use crate::protocol::{CallbackEnvelope, ServerEventEnvelope, SupabaseClientEnvelope};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProtocolParityFixture {
    #[serde(rename = "clientControlMessage")]
    pub client_control_message: SupabaseClientEnvelope,
    #[serde(rename = "expectedClientControlJson")]
    pub expected_client_control_json: String,
    #[serde(rename = "serverRoomMessage")]
    pub server_room_message: ServerEventEnvelope,
    #[serde(rename = "expectedServerRoomJson")]
    pub expected_server_room_json: String,
    #[serde(rename = "serverCallbackMessage")]
    pub server_callback_message: CallbackEnvelope,
    #[serde(rename = "expectedServerCallbackJson")]
    pub expected_server_callback_json: String,
}

pub fn load_protocol_fixture(
    path: &Path,
) -> Result<ProtocolParityFixture, Box<dyn std::error::Error>> {
    let contents = fs::read_to_string(path)?;
    let fixture = serde_json::from_str(&contents)?;
    Ok(fixture)
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::load_protocol_fixture;

    #[test]
    fn protocol_fixture_json_matches_typescript_snapshots() -> Result<(), Box<dyn std::error::Error>>
    {
        let fixture_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../shared/gameplay-fixtures/protocol/socket-transport.json");
        let fixture = load_protocol_fixture(&fixture_path)?;

        let client_json = serde_json::to_string(&fixture.client_control_message)?;
        let room_json = serde_json::to_string(&fixture.server_room_message)?;
        let callback_json = serde_json::to_string(&fixture.server_callback_message)?;

        assert_eq!(client_json, fixture.expected_client_control_json);
        assert_eq!(room_json, fixture.expected_server_room_json);
        assert_eq!(callback_json, fixture.expected_server_callback_json);
        Ok(())
    }
}
