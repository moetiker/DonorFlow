'use client'

import { Modal, Table, Badge } from 'react-bootstrap'

type Member = {
  id: string
  firstName: string
  lastName: string
}

type Props = {
  show: boolean
  groupId: string | null
  groupName: string
  members: Member[]
  onHide: () => void
}

export function GroupMembersModal({ show, groupId, groupName, members, onHide }: Props) {
  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Mitglieder: {groupName}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {members.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-people fs-1 mb-3 d-block"></i>
            <p>Keine Mitglieder vorhanden</p>
          </div>
        ) : (
          <>
            <div className="mb-3">
              <Badge bg="primary" className="fs-6">
                {members.length} Mitglieder
              </Badge>
            </div>
            <Table striped hover>
              <thead>
                <tr>
                  <th>Name</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <strong>{member.firstName} {member.lastName}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
      </Modal.Body>
    </Modal>
  )
}