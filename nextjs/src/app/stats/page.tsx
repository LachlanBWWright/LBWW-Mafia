'use client';

import { useSession } from 'next-auth/react';
import { api } from '~/utils/api';
import Link from 'next/link';
import { Card, CardBody, CardTitle } from "react-bootstrap";

export default function Stats() {
  const { data: session, status } = useSession();
  
  const { data: stats, isLoading } = api.stats.getPersonalStats.useQuery(undefined, {
    enabled: status === 'authenticated',
  });

  if (status === 'unauthenticated') {
    return (
      <div className="container-fluid" style={{ flex: 1, margin: "2vh", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Card style={{ maxWidth: '600px', width: '100%' }}>
          <CardBody className="text-center">
            <CardTitle>📊 Statistics</CardTitle>
            <p className="text-muted mt-3">
              Sign in to view your personal statistics and track your progress!
            </p>
            <Link href="/auth/signin?callbackUrl=/stats" className="btn btn-primary mt-3">
              Sign In to View Stats
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <Card style={{ flex: 1, margin: "2vh" }}>
        <CardBody>
          <CardTitle className="text-center">Statistics</CardTitle>
          <div className="text-center mt-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="container-fluid" style={{ flex: 1, margin: "2vh", overflowY: 'auto' }}>
      <Card className="mb-3">
        <CardBody>
          <CardTitle className="text-center mb-4">📊 Your Statistics</CardTitle>
          
          {/* Overall Stats */}
          <div className="row mb-4">
            <div className="col-md-4 mb-3">
              <Card className="h-100 bg-primary text-white">
                <CardBody className="text-center">
                  <h2 className="display-4">{stats?.totalGames ?? 0}</h2>
                  <p className="mb-0">Total Games</p>
                </CardBody>
              </Card>
            </div>
            <div className="col-md-4 mb-3">
              <Card className="h-100 bg-success text-white">
                <CardBody className="text-center">
                  <h2 className="display-4">{stats?.totalWins ?? 0}</h2>
                  <p className="mb-0">Games Won</p>
                </CardBody>
              </Card>
            </div>
            <div className="col-md-4 mb-3">
              <Card className="h-100 bg-info text-white">
                <CardBody className="text-center">
                  <h2 className="display-4">{stats?.winRate?.toFixed(1) ?? 0}%</h2>
                  <p className="mb-0">Win Rate</p>
                </CardBody>
              </Card>
            </div>
          </div>

          {/* Faction Stats */}
          <h5 className="mb-3">Faction Performance</h5>
          <div className="row mb-4">
            <div className="col-md-4 mb-3">
              <Card>
                <CardBody>
                  <h6 className="text-primary">🏛️ Town</h6>
                  <p className="mb-1">Games: {stats?.townGames ?? 0}</p>
                  <p className="mb-0">Wins: {stats?.townWins ?? 0}</p>
                  <small className="text-muted">
                    Win Rate: {stats?.townGames ? ((stats.townWins / stats.townGames) * 100).toFixed(1) : 0}%
                  </small>
                </CardBody>
              </Card>
            </div>
            <div className="col-md-4 mb-3">
              <Card>
                <CardBody>
                  <h6 className="text-danger">🗡️ Mafia</h6>
                  <p className="mb-1">Games: {stats?.mafiaGames ?? 0}</p>
                  <p className="mb-0">Wins: {stats?.mafiaWins ?? 0}</p>
                  <small className="text-muted">
                    Win Rate: {stats?.mafiaGames ? ((stats.mafiaWins / stats.mafiaGames) * 100).toFixed(1) : 0}%
                  </small>
                </CardBody>
              </Card>
            </div>
            <div className="col-md-4 mb-3">
              <Card>
                <CardBody>
                  <h6 className="text-warning">⚖️ Neutral</h6>
                  <p className="mb-1">Games: {stats?.neutralGames ?? 0}</p>
                  <p className="mb-0">Wins: {stats?.neutralWins ?? 0}</p>
                  <small className="text-muted">
                    Win Rate: {stats?.neutralGames ? ((stats.neutralWins / stats.neutralGames) * 100).toFixed(1) : 0}%
                  </small>
                </CardBody>
              </Card>
            </div>
          </div>

          {/* Role Stats */}
          {stats?.roleStats && stats.roleStats.length > 0 && (
            <>
              <h5 className="mb-3">Role Performance</h5>
              <div className="row">
                {stats.roleStats.map((rolestat) => (
                  <div key={rolestat.role} className="col-md-3 col-sm-6 mb-3">
                    <Card>
                      <CardBody>
                        <h6 className="mb-2">{rolestat.role}</h6>
                        <p className="mb-0 text-muted">
                          Played: {rolestat.gamesPlayed} times
                        </p>
                      </CardBody>
                    </Card>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Quick Links */}
          <div className="mt-4 d-flex gap-2 flex-wrap justify-content-center">
            <Link href="/history" className="btn btn-outline-primary">
              View Match History
            </Link>
            <Link href="/leaderboard" className="btn btn-outline-success">
              View Leaderboard
            </Link>
            <Link href="/account" className="btn btn-outline-secondary">
              My Account
            </Link>
          </div>

          {stats?.totalGames === 0 && (
            <div className="alert alert-info mt-4">
              <strong>No games played yet!</strong> Start playing to see your statistics here.
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
