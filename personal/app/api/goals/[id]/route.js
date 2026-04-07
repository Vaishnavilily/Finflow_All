import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Goal from '@/lib/models/Goal';
import User from '@/lib/models/user';

export async function DELETE(request, { params }) {
  try {
    await connectDB();
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const authId = searchParams.get('authId');

    if (!authId) {
      return NextResponse.json({ error: 'Missing authId' }, { status: 400 });
    }

    const deleted = await Goal.findOneAndDelete({ _id: id, ownerAuthId: authId });
    if (!deleted) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }
    await User.updateOne({ authId }, { $pull: { goals: id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    await connectDB();
    const { id } = params;
    const body = await request.json();
    const { authId, ...updates } = body;

    if (!authId) {
      return NextResponse.json({ error: 'Missing authId' }, { status: 400 });
    }

    const goal = await Goal.findOneAndUpdate(
      { _id: id, ownerAuthId: authId },
      updates,
      { new: true, runValidators: true }
    );
    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }
    return NextResponse.json(goal);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
